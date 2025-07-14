import mongoose from 'mongoose';
const PaymentLinkSchema = new mongoose.Schema({
    linkId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, required: true, default: 'active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
export const PaymentLink = mongoose.model('PaymentLink', PaymentLinkSchema);
//# sourceMappingURL=PaymentLink.js.map