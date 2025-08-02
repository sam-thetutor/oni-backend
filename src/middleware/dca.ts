import { Request, Response, NextFunction } from 'express';
import { DCAService } from '../services/dca.js';
import { DCA_LIMITS } from '../constants/tokens.js';

import { AuthenticatedRequest } from './auth.js';

// Rate limiting for DCA operations
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware for DCA order creation
 */
export const rateLimitDCAOrders = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const frontendWalletAddress = req.user?.frontendWalletAddress;
  
  if (!frontendWalletAddress) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 5; // Max 5 DCA order creations per minute

  const userLimit = rateLimitStore.get(frontendWalletAddress);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    rateLimitStore.set(frontendWalletAddress, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (userLimit.count >= maxRequests) {
    return res.status(429).json({
      error: 'Too many DCA order requests. Please try again later.',
      retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
    });
  }

  // Increment count
  userLimit.count++;
  return next();
};

/**
 * Middleware to check if user has reached maximum active orders
 */
export const checkMaxActiveOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const frontendWalletAddress = req.user?.frontendWalletAddress;
    
    if (!frontendWalletAddress) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const activeOrders = await DCAService.getUserDCAOrders(frontendWalletAddress, 'active');
    
    if (activeOrders.length >= DCA_LIMITS.MAX_ORDERS_PER_USER) {
      return res.status(400).json({
        error: `Maximum of ${DCA_LIMITS.MAX_ORDERS_PER_USER} active DCA orders allowed per user`,
        currentActiveOrders: activeOrders.length
      });
    }

    next();
  } catch (error) {
    console.error('Error checking max active orders:', error);
    res.status(500).json({ error: 'Failed to validate order limits' });
  }
};

/**
 * Middleware to validate DCA order amounts against user balance
 */
export const validateOrderBalance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { orderType, amount } = req.body;
    const frontendWalletAddress = req.user?.frontendWalletAddress;
    
    if (!frontendWalletAddress) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Import services dynamically to avoid circular dependencies
    const { MongoDBService } = await import('../services/mongodb.js');
    const { TokenService } = await import('../services/tokens.js');
    const { TOKEN_METADATA } = await import('../constants/tokens.js');

    // Get user wallet
    const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
    if (!user) {
      return res.status(404).json({ error: 'User wallet not found' });
    }

    // Determine token being spent
    const tokenSymbol = orderType === 'buy' ? 'tUSDC' : 'XFI';
    const tokenMeta = TOKEN_METADATA[tokenSymbol as keyof typeof TOKEN_METADATA];
    
    // Check balance
    const balanceCheck = await TokenService.validateSufficientBalance(
      tokenMeta.address,
      user.walletAddress,
      amount.toString(),
      true // Include gas estimation
    );

    if (!balanceCheck.sufficient) {
      return res.status(400).json({
        error: `Insufficient ${tokenSymbol} balance`,
        details: {
          required: balanceCheck.required,
          available: balanceCheck.balance,
          shortfall: balanceCheck.shortfall
        }
      });
    }

    next();
  } catch (error) {
    console.error('Error validating order balance:', error);
    res.status(500).json({ error: 'Failed to validate balance' });
  }
};

/**
 * Middleware to validate order ownership for updates/cancellations
 */
export const validateOrderOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const frontendWalletAddress = req.user?.frontendWalletAddress;
    
    if (!frontendWalletAddress) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const order = await DCAService.getDCAOrderById(orderId, frontendWalletAddress);
    
    if (!order) {
      return res.status(404).json({ error: 'DCA order not found or access denied' });
    }

    // Check if order can be modified
    if (!['active', 'failed'].includes(order.status)) {
      return res.status(400).json({
        error: `Cannot modify order with status: ${order.status}`,
        allowedStatuses: ['active', 'failed']
      });
    }

    // Attach order to request for use in controller
    (req as any).dcaOrder = order;
    next();
  } catch (error) {
    console.error('Error validating order ownership:', error);
    res.status(500).json({ error: 'Failed to validate order ownership' });
  }
};

/**
 * Middleware to validate trigger price against current market conditions
 */
export const validateTriggerPrice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { triggerPrice, triggerCondition } = req.body;
    
    if (!triggerPrice || !triggerCondition) {
      return next(); // Skip if not provided (will be caught by main validation)
    }

    // Import service dynamically
    const { PriceAnalyticsService } = await import('../services/price-analytics.js');
    
    // Get current market price
    const marketData = await PriceAnalyticsService.getMarketData();
    const currentPrice = marketData.current_price;
    
    // Check if trigger price makes sense
    const priceDifference = Math.abs(triggerPrice - currentPrice) / currentPrice;
    const maxReasonableDifference = 0.5; // 50% difference warning
    
    if (priceDifference > maxReasonableDifference) {
      // Add warning but don't block
      (req as any).priceWarning = {
        message: `Trigger price $${triggerPrice} is ${(priceDifference * 100).toFixed(1)}% away from current price $${currentPrice.toFixed(6)}`,
        currentPrice,
        triggerPrice,
        difference: priceDifference
      };
    }

    // Check if trigger would execute immediately
    // Allow immediate execution for DCA orders - this is a valid use case
    const wouldExecuteImmediately = 
      (triggerCondition === 'above' && currentPrice >= triggerPrice) ||
      (triggerCondition === 'below' && currentPrice <= triggerPrice);
    
    if (wouldExecuteImmediately) {
      // Add a warning but don't block the order
      (req as any).immediateExecutionWarning = {
        message: 'Order will execute immediately at current market price',
        currentPrice,
        triggerPrice,
        triggerCondition
      };
    }

    next();
  } catch (error) {
    console.error('Error validating trigger price:', error);
    // Don't block on price validation errors, just log and continue
    next();
  }
};

/**
 * Sanitize and validate numeric inputs
 */
export const sanitizeNumericInputs = (req: Request, res: Response, next: NextFunction) => {
  const { amount, triggerPrice, slippage, expirationDays } = req.body;
  
  // Validate and sanitize amount
  if (amount !== undefined) {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount: must be a positive number' });
    }
    req.body.amount = parsedAmount.toString();
  }
  
  // Validate and sanitize trigger price
  if (triggerPrice !== undefined) {
    const parsedPrice = parseFloat(triggerPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Invalid trigger price: must be a positive number' });
    }
    req.body.triggerPrice = parsedPrice;
  }
  
  // Validate and sanitize slippage
  if (slippage !== undefined) {
    const parsedSlippage = parseFloat(slippage);
    if (isNaN(parsedSlippage) || parsedSlippage < 0 || parsedSlippage > 50) {
      return res.status(400).json({ error: 'Invalid slippage: must be between 0 and 50' });
    }
    req.body.slippage = parsedSlippage;
  }
  
  // Validate and sanitize expiration days
  if (expirationDays !== undefined) {
    const parsedDays = parseInt(expirationDays);
    if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      return res.status(400).json({ error: 'Invalid expiration days: must be between 1 and 365' });
    }
    req.body.expirationDays = parsedDays;
  }
  
  next();
};

/**
 * Clean up expired rate limits periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of rateLimitStore.entries()) {
    if (now > limit.resetTime) {
      rateLimitStore.delete(userId);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes 