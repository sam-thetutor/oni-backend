import { DCAService } from '../services/dca.js';
import { DCA_LIMITS } from '../constants/tokens.js';
const rateLimitStore = new Map();
export const rateLimitDCAOrders = (req, res, next) => {
    const frontendWalletAddress = req.user?.frontendWalletAddress;
    if (!frontendWalletAddress) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxRequests = 5;
    const userLimit = rateLimitStore.get(frontendWalletAddress);
    if (!userLimit || now > userLimit.resetTime) {
        rateLimitStore.set(frontendWalletAddress, { count: 1, resetTime: now + windowMs });
        return next();
    }
    if (userLimit.count >= maxRequests) {
        return res.status(429).json({
            error: 'Too many DCA order requests. Please try again later.',
            retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
        });
    }
    userLimit.count++;
    return next();
};
export const checkMaxActiveOrders = async (req, res, next) => {
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
    }
    catch (error) {
        console.error('Error checking max active orders:', error);
        res.status(500).json({ error: 'Failed to validate order limits' });
    }
};
export const validateOrderBalance = async (req, res, next) => {
    try {
        const { orderType, amount } = req.body;
        const frontendWalletAddress = req.user?.frontendWalletAddress;
        if (!frontendWalletAddress) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { MongoDBService } = await import('../services/mongodb.js');
        const { TokenService } = await import('../services/tokens.js');
        const { TOKEN_METADATA } = await import('../constants/tokens.js');
        const user = await MongoDBService.getWalletByFrontendAddress(frontendWalletAddress);
        if (!user) {
            return res.status(404).json({ error: 'User wallet not found' });
        }
        const tokenSymbol = orderType === 'buy' ? 'tUSDC' : 'XFI';
        const tokenMeta = TOKEN_METADATA[tokenSymbol];
        const balanceCheck = await TokenService.validateSufficientBalance(tokenMeta.address, user.walletAddress, amount.toString(), true);
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
    }
    catch (error) {
        console.error('Error validating order balance:', error);
        res.status(500).json({ error: 'Failed to validate balance' });
    }
};
export const validateOrderOwnership = async (req, res, next) => {
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
        if (!['active', 'failed'].includes(order.status)) {
            return res.status(400).json({
                error: `Cannot modify order with status: ${order.status}`,
                allowedStatuses: ['active', 'failed']
            });
        }
        req.dcaOrder = order;
        next();
    }
    catch (error) {
        console.error('Error validating order ownership:', error);
        res.status(500).json({ error: 'Failed to validate order ownership' });
    }
};
export const validateTriggerPrice = async (req, res, next) => {
    try {
        const { triggerPrice, triggerCondition } = req.body;
        if (!triggerPrice || !triggerCondition) {
            return next();
        }
        const { PriceAnalyticsService } = await import('../services/price-analytics.js');
        const marketData = await PriceAnalyticsService.getMarketData();
        const currentPrice = marketData.current_price;
        const priceDifference = Math.abs(triggerPrice - currentPrice) / currentPrice;
        const maxReasonableDifference = 0.5;
        if (priceDifference > maxReasonableDifference) {
            req.priceWarning = {
                message: `Trigger price $${triggerPrice} is ${(priceDifference * 100).toFixed(1)}% away from current price $${currentPrice.toFixed(6)}`,
                currentPrice,
                triggerPrice,
                difference: priceDifference
            };
        }
        const wouldExecuteImmediately = (triggerCondition === 'above' && currentPrice >= triggerPrice) ||
            (triggerCondition === 'below' && currentPrice <= triggerPrice);
        if (wouldExecuteImmediately) {
            req.immediateExecutionWarning = {
                message: 'Order will execute immediately at current market price',
                currentPrice,
                triggerPrice,
                triggerCondition
            };
        }
        next();
    }
    catch (error) {
        console.error('Error validating trigger price:', error);
        next();
    }
};
export const sanitizeNumericInputs = (req, res, next) => {
    const { amount, triggerPrice, slippage, expirationDays } = req.body;
    if (amount !== undefined) {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Invalid amount: must be a positive number' });
        }
        req.body.amount = parsedAmount.toString();
    }
    if (triggerPrice !== undefined) {
        const parsedPrice = parseFloat(triggerPrice);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            return res.status(400).json({ error: 'Invalid trigger price: must be a positive number' });
        }
        req.body.triggerPrice = parsedPrice;
    }
    if (slippage !== undefined) {
        const parsedSlippage = parseFloat(slippage);
        if (isNaN(parsedSlippage) || parsedSlippage < 0 || parsedSlippage > 50) {
            return res.status(400).json({ error: 'Invalid slippage: must be between 0 and 50' });
        }
        req.body.slippage = parsedSlippage;
    }
    if (expirationDays !== undefined) {
        const parsedDays = parseInt(expirationDays);
        if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 365) {
            return res.status(400).json({ error: 'Invalid expiration days: must be between 1 and 365' });
        }
        req.body.expirationDays = parsedDays;
    }
    next();
};
setInterval(() => {
    const now = Date.now();
    for (const [userId, limit] of rateLimitStore.entries()) {
        if (now > limit.resetTime) {
            rateLimitStore.delete(userId);
        }
    }
}, 5 * 60 * 1000);
//# sourceMappingURL=dca.js.map