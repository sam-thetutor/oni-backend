import { DCAService, CreateDCAOrderParams } from '../services/dca.js';
import { SwapService } from '../services/swap.js';
import { PriceMonitorService } from '../services/price-monitor.js';
import { DCAExecutorService } from '../services/dca-executor.js';
import { TokenService } from '../services/tokens.js';
import { PriceAnalyticsService } from '../services/price-analytics.js';
import { WalletService } from '../services/wallet.js';
import { DCA_LIMITS, validateTriggerPrice, validateSlippage } from '../constants/tokens.js';

/**
 * AI Tool: Create DCA Order
 * Allows users to create automated swap orders triggered by price conditions
 */
export async function createDCAOrder(params: {
  userId: string;
  orderType: 'buy' | 'sell';
  amount: string;
  triggerPrice: number;
  triggerCondition: 'above' | 'below';
  slippage?: number;
  expirationDays?: number;
}): Promise<{
  success: boolean;
  orderId?: string;
  message: string;
  orderDetails?: any;
}> {
  try {
    // Get user wallet by address (userId is actually wallet address)
    const user = await WalletService.getWalletByAddress(params.userId);
    if (!user) {
      return {
        success: false,
        message: 'User wallet not found. Please connect your wallet first.',
      };
    }

    // Validate trigger price
    if (!validateTriggerPrice(params.triggerPrice)) {
      return {
        success: false,
        message: `Trigger price must be between $${DCA_LIMITS.MIN_TRIGGER_PRICE} and $${DCA_LIMITS.MAX_TRIGGER_PRICE}`,
      };
    }

    // Validate slippage if provided
    const slippage = params.slippage || DCA_LIMITS.DEFAULT_SLIPPAGE;
    if (!validateSlippage(slippage)) {
      return {
        success: false,
        message: `Slippage must be between ${DCA_LIMITS.MIN_SLIPPAGE}% and ${DCA_LIMITS.MAX_SLIPPAGE}%`,
      };
    }

    // Calculate expiration date
    const expirationDays = params.expirationDays || 30;
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

    // Create DCA order parameters
    const dcaParams: CreateDCAOrderParams = {
      userId: user.privyId, // Use the actual privyId for DCA order storage
      walletAddress: user.walletAddress,
      orderType: params.orderType,
      fromAmount: params.amount,
      triggerPrice: params.triggerPrice,
      triggerCondition: params.triggerCondition,
      maxSlippage: slippage,
      expiresAt,
    };

    // Create the order
    const order = await DCAService.createDCAOrder(dcaParams);

    // Get current price for context
    const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);
    
    // Format response message
    const tokenSymbol = params.orderType === 'buy' ? 'tUSDC' : 'XFI';
    const targetSymbol = params.orderType === 'buy' ? 'XFI' : 'tUSDC';
    const conditionText = params.triggerCondition === 'above' ? 'reaches or exceeds' : 'drops to or below';
    
    return {
      success: true,
      orderId: order._id.toString(),
      message: `✅ DCA order created successfully!\n\n` +
        `📊 Order Details:\n` +
        `• Type: ${params.orderType === 'buy' ? 'Buy XFI with tUSDC' : 'Sell XFI for tUSDC'}\n` +
        `• Amount: ${params.amount} ${tokenSymbol}\n` +
        `• Trigger: When XFI price ${conditionText} $${params.triggerPrice}\n` +
        `• Current Price: $${currentPrice.toFixed(6)}\n` +
        `• Slippage: ${slippage}%\n` +
        `• Expires: ${expiresAt.toLocaleDateString()}\n\n` +
        `🔄 Your order will be automatically executed when the conditions are met.`,
      orderDetails: {
        orderId: order._id.toString(),
        orderType: params.orderType,
        fromAmount: params.amount,
        fromToken: tokenSymbol,
        toToken: targetSymbol,
        triggerPrice: params.triggerPrice,
        triggerCondition: params.triggerCondition,
        currentPrice,
        slippage,
        expiresAt,
      },
    };
  } catch (error: any) {
    console.error('Error creating DCA order:', error);
    return {
      success: false,
      message: `Failed to create DCA order: ${error.message}`,
    };
  }
}

/**
 * AI Tool: Get User's DCA Orders
 * Lists all DCA orders for a user with their current status
 */
export async function getUserDCAOrders(params: {
  userId: string;
  status?: 'active' | 'executed' | 'cancelled' | 'failed' | 'expired';
  limit?: number;
}): Promise<{
  success: boolean;
  message: string;
  orders?: any[];
}> {
  try {
    // Get user by wallet address to get their privyId
    const user = await WalletService.getWalletByAddress(params.userId);
    if (!user) {
      return {
        success: false,
        message: 'User wallet not found. Please connect your wallet first.',
      };
    }

    const orders = await DCAService.getUserDCAOrders(
      user.privyId, // Use privyId for DCA order lookup
      params.status,
      params.limit || 10
    );

    if (orders.length === 0) {
      const statusText = params.status ? ` ${params.status}` : '';
      return {
        success: true,
        message: `No${statusText} DCA orders found. You can create a new order by saying something like "swap 20 tUSDC when XFI hits $0.10".`,
        orders: [],
      };
    }

    // Get current price for context
    const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);

    // Format orders for display
    const formattedOrders = orders.map(order => {
      const priceDistance = ((order.triggerPrice - currentPrice) / currentPrice * 100).toFixed(2);
      const distanceText = order.triggerCondition === 'above' 
        ? `+${priceDistance}%` 
        : `${priceDistance}%`;
      
      return {
        ...order,
        currentPrice,
        priceDistance: distanceText,
        statusEmoji: getStatusEmoji(order.status),
      };
    });

    // Create summary message
    const statusText = params.status ? ` ${params.status}` : '';
    let message = `📋 Your${statusText} DCA Orders (Current XFI Price: $${currentPrice.toFixed(6)}):\n\n`;
    
    formattedOrders.forEach((order, index) => {
      message += `${index + 1}. ${order.statusEmoji} ${order.orderType === 'buy' ? 'Buy' : 'Sell'} ${order.fromAmountFormatted} ${order.fromToken}\n`;
      message += `   • Trigger: $${order.triggerPrice} (${order.priceDistance} from current)\n`;
      message += `   • Status: ${order.status}\n`;
      message += `   • Created: ${new Date(order.createdAt).toLocaleDateString()}\n\n`;
    });

    return {
      success: true,
      message,
      orders: formattedOrders,
    };
  } catch (error: any) {
    console.error('Error getting user DCA orders:', error);
    return {
      success: false,
      message: `Failed to get DCA orders: ${error.message}`,
    };
  }
}

/**
 * AI Tool: Cancel DCA Order
 * Allows users to cancel an active DCA order
 */
export async function cancelDCAOrder(params: {
  userId: string;
  orderId: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Get user by wallet address to get their privyId
    const user = await WalletService.getWalletByAddress(params.userId);
    if (!user) {
      return {
        success: false,
        message: 'User wallet not found. Please connect your wallet first.',
      };
    }

    const cancelled = await DCAService.cancelDCAOrder(params.orderId, user.privyId);
    
    if (cancelled) {
      return {
        success: true,
        message: `✅ DCA order cancelled successfully. The order will no longer be executed.`,
      };
    } else {
      return {
        success: false,
        message: `❌ Could not cancel the order. It may not exist, may not belong to you, or may have already been executed.`,
      };
    }
  } catch (error: any) {
    console.error('Error cancelling DCA order:', error);
    return {
      success: false,
      message: `Failed to cancel DCA order: ${error.message}`,
    };
  }
}

/**
 * AI Tool: Get DCA Order Status
 * Provides detailed information about a specific DCA order
 */
export async function getDCAOrderStatus(params: {
  userId: string;
  orderId: string;
}): Promise<{
  success: boolean;
  message: string;
  orderDetails?: any;
}> {
  try {
    // Get user by wallet address to get their privyId
    const user = await WalletService.getWalletByAddress(params.userId);
    if (!user) {
      return {
        success: false,
        message: 'User wallet not found. Please connect your wallet first.',
      };
    }

    const order = await DCAService.getDCAOrderById(params.orderId, user.privyId);
    
    if (!order) {
      return {
        success: false,
        message: `❌ DCA order not found. Please check the order ID and try again.`,
      };
    }

    // Get current price for context
    const currentPrice = await PriceAnalyticsService.getMarketData().then(data => data.current_price);
    const shouldExecute = DCAService.shouldExecuteOrder(order, currentPrice);
    
    // Calculate price distance
    const priceDistance = ((order.triggerPrice - currentPrice) / currentPrice * 100).toFixed(2);
    const distanceText = order.triggerCondition === 'above' 
      ? `${priceDistance}% above current` 
      : `${Math.abs(parseFloat(priceDistance))}% below current`;

    // Format message based on order status
    let message = `📊 DCA Order Details (${order._id})\n\n`;
    message += `${getStatusEmoji(order.status)} Status: ${order.status.toUpperCase()}\n`;
    message += `💱 Type: ${order.orderType === 'buy' ? 'Buy XFI with tUSDC' : 'Sell XFI for tUSDC'}\n`;
    message += `💰 Amount: ${TokenService.formatTokenAmount(order.fromAmount, order.orderType === 'buy' ? 6 : 18)} ${order.orderType === 'buy' ? 'tUSDC' : 'XFI'}\n`;
    message += `🎯 Trigger: $${order.triggerPrice} (${distanceText})\n`;
    message += `📈 Current Price: $${currentPrice.toFixed(6)}\n`;
    message += `📅 Created: ${order.createdAt.toLocaleString()}\n`;
    
    if (order.expiresAt) {
      message += `⏰ Expires: ${order.expiresAt.toLocaleString()}\n`;
    }
    
    if (order.status === 'active') {
      message += `\n🔍 Ready to Execute: ${shouldExecute ? 'YES ✅' : 'NO (waiting for trigger price)'}\n`;
    }
    
    if (order.status === 'executed') {
      message += `\n✅ Executed at: ${order.executedAt?.toLocaleString()}\n`;
      message += `💱 Execution Price: $${order.executedPrice?.toFixed(6)}\n`;
      if (order.transactionHash) {
        message += `🔗 Transaction: ${order.transactionHash}\n`;
      }
    }
    
    if (order.status === 'failed') {
      message += `\n❌ Failure Reason: ${order.failureReason}\n`;
      message += `🔄 Retry Count: ${order.retryCount}/${order.maxRetries}\n`;
    }

    return {
      success: true,
      message,
      orderDetails: {
        ...order.toObject(),
        currentPrice,
        shouldExecute,
        priceDistance,
      },
    };
  } catch (error: any) {
    console.error('Error getting DCA order status:', error);
    return {
      success: false,
      message: `Failed to get order status: ${error.message}`,
    };
  }
}

/**
 * AI Tool: Get Swap Quote
 * Provides a quote for immediate token swap
 */
export async function getSwapQuote(params: {
  fromToken: 'XFI' | 'tUSDC';
  toToken: 'XFI' | 'tUSDC';
  amount: string;
  slippage?: number;
}): Promise<{
  success: boolean;
  message: string;
  quote?: any;
}> {
  try {
    const quote = await SwapService.getSwapQuote(
      params.fromToken,
      params.toToken,
      params.amount,
      params.slippage || 5
    );

    const message = `💱 Swap Quote\n\n` +
      `📥 You give: ${quote.fromAmountFormatted} ${quote.fromToken}\n` +
      `📤 You get: ${quote.toAmountFormatted} ${quote.toToken}\n` +
      `💰 Price: $${quote.price.toFixed(6)} per XFI\n` +
      `🎯 Min. received: ${quote.minimumReceivedFormatted} ${quote.toToken}\n` +
      `⛽ Est. gas fee: ${quote.gasFeeFormatted} XFI\n` +
      `📊 Slippage: ${quote.slippage}%\n\n` +
      `Note: This is an instant swap quote. For automated swaps based on price triggers, use DCA orders.`;

    return {
      success: true,
      message,
      quote,
    };
  } catch (error: any) {
    console.error('Error getting swap quote:', error);
    return {
      success: false,
      message: `Failed to get swap quote: ${error.message}`,
    };
  }
}

/**
 * AI Tool: Check DCA System Status
 * Provides information about the DCA monitoring system
 */
export async function getDCASystemStatus(): Promise<{
  success: boolean;
  message: string;
  status?: any;
}> {
  try {
    const executorStatus = await DCAExecutorService.getStatus();
    const priceMonitorStatus = PriceMonitorService.getMonitoringStatus();
    
    let message = `🔧 DCA System Status\n\n`;
    message += `📊 Executor: ${executorStatus.isRunning ? '🟢 Running' : '🔴 Stopped'}\n`;
    message += `📈 Price Monitor: ${priceMonitorStatus.isRunning ? '🟢 Active' : '🔴 Inactive'}\n`;
    message += `⏰ Last Check: ${priceMonitorStatus.lastCheck.toLocaleTimeString()}\n`;
    message += `💰 Last Price: $${priceMonitorStatus.lastPrice.toFixed(6)}\n`;
    message += `📊 Total Checks: ${priceMonitorStatus.totalChecks}\n`;
    message += `✅ Executed Orders: ${priceMonitorStatus.executedOrders}\n`;
    message += `❌ Errors: ${priceMonitorStatus.errors}\n`;
    message += `⏱️ Uptime: ${executorStatus.uptime}\n\n`;
    message += `🔄 Next check in ~${Math.ceil((priceMonitorStatus.nextCheck.getTime() - Date.now()) / 1000)}s`;

    return {
      success: true,
      message,
      status: {
        executor: executorStatus,
        priceMonitor: priceMonitorStatus,
      },
    };
  } catch (error: any) {
    console.error('Error getting DCA system status:', error);
    return {
      success: false,
      message: `Failed to get system status: ${error.message}`,
    };
  }
}

/**
 * AI Tool: Get User's Token Balances
 * Shows current balances for DCA-supported tokens
 */
export async function getUserTokenBalances(params: {
  userId: string;
}): Promise<{
  success: boolean;
  message: string;
  balances?: any[];
}> {
  try {
    // Get user by wallet address (userId is actually wallet address)
    const user = await WalletService.getWalletByAddress(params.userId);
    if (!user) {
      return {
        success: false,
        message: 'User wallet not found. Please connect your wallet first.',
      };
    }

    const balances = await TokenService.getDCATokenBalances(user.walletAddress);
    
    let message = `💰 Your Token Balances\n\n`;
    
    balances.forEach(balance => {
      message += `${balance.symbol === 'XFI' ? '🔵' : '🟢'} ${balance.symbol}: ${parseFloat(balance.formatted).toFixed(6)}\n`;
    });

    message += `\n💡 You can create DCA orders to automatically swap between XFI and tUSDC based on price triggers.`;

    return {
      success: true,
      message,
      balances,
    };
  } catch (error: any) {
    console.error('Error getting user token balances:', error);
    return {
      success: false,
      message: `Failed to get token balances: ${error.message}`,
    };
  }
}

// Helper function to get status emoji
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'active': return '🟡';
    case 'executed': return '✅';
    case 'cancelled': return '❌';
    case 'failed': return '🔴';
    case 'expired': return '⏰';
    default: return '❓';
  }
} 