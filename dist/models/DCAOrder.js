import mongoose from 'mongoose';
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
        max: 50,
        default: 5
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
    timestamps: true
});
DCAOrderSchema.index({ userId: 1, status: 1 });
DCAOrderSchema.index({ status: 1, triggerPrice: 1 });
DCAOrderSchema.index({ walletAddress: 1, status: 1 });
DCAOrderSchema.index({ createdAt: -1 });
DCAOrderSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const DCAOrder = mongoose.model('DCAOrder', DCAOrderSchema);
//# sourceMappingURL=DCAOrder.js.map