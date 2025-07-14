import mongoose from 'mongoose';

export interface IDCAOrder extends mongoose.Document {
  userId: string; // Privy ID of the user
  walletAddress: string; // User's wallet address
  orderType: 'buy' | 'sell'; // Buy XFI with tUSDC or sell XFI for tUSDC
  fromToken: string; // Token address being sold (tUSDC or XFI)
  toToken: string; // Token address being bought (XFI or tUSDC)
  fromAmount: string; // Amount to swap (in wei/smallest unit)
  triggerPrice: number; // XFI price in USD that triggers the order
  triggerCondition: 'above' | 'below'; // Execute when price goes above or below
  maxSlippage: number; // Maximum slippage tolerance (percentage)
  status: 'active' | 'executed' | 'cancelled' | 'failed' | 'expired';
  executedAt?: Date;
  executedPrice?: number;
  executedAmount?: string;
  transactionHash?: string;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  expiresAt?: Date; // Optional expiration date
  createdAt: Date;
  updatedAt: Date;
}

const DCAOrderSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  walletAddress: { 
    type: String, 
    required: true, 
    index: true 
  },
  orderType: { 
    type: String, 
    enum: ['buy', 'sell'], 
    required: true 
  },
  fromToken: { 
    type: String, 
    required: true 
  },
  toToken: { 
    type: String, 
    required: true 
  },
  fromAmount: { 
    type: String, 
    required: true 
  },
  triggerPrice: { 
    type: Number, 
    required: true,
    min: 0
  },
  triggerCondition: { 
    type: String, 
    enum: ['above', 'below'], 
    required: true 
  },
  maxSlippage: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 50, // Max 50% slippage
    default: 5 // 5% default slippage
  },
  status: { 
    type: String, 
    enum: ['active', 'executed', 'cancelled', 'failed', 'expired'], 
    default: 'active',
    index: true
  },
  executedAt: { 
    type: Date 
  },
  executedPrice: { 
    type: Number 
  },
  executedAmount: { 
    type: String 
  },
  transactionHash: { 
    type: String 
  },
  failureReason: { 
    type: String 
  },
  retryCount: { 
    type: Number, 
    default: 0 
  },
  maxRetries: { 
    type: Number, 
    default: 3 
  },
  expiresAt: { 
    type: Date 
  }
}, {
  timestamps: true // Automatically add createdAt and updatedAt
});

// Compound indexes for efficient querying
DCAOrderSchema.index({ userId: 1, status: 1 });
DCAOrderSchema.index({ status: 1, triggerPrice: 1 });
DCAOrderSchema.index({ walletAddress: 1, status: 1 });
DCAOrderSchema.index({ createdAt: -1 });

// Add expiration index for automatic cleanup
DCAOrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const DCAOrder = mongoose.model<IDCAOrder>('DCAOrder', DCAOrderSchema); 