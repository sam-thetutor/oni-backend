import mongoose from 'mongoose';

interface IPaymentLink {
  linkId: string;
  userId: string;
  amount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentLinkSchema = new mongoose.Schema({
  linkId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, required: true, default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const PaymentLink = mongoose.model<IPaymentLink>('PaymentLink', PaymentLinkSchema); 