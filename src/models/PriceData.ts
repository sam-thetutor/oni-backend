import mongoose from 'mongoose';

interface IPriceData {
  coinId: string;
  dataType: 'market' | 'chart';
  data: any;
  fetchedAt: Date;
  expiresAt: Date;
}

const PriceDataSchema = new mongoose.Schema({
  coinId: { type: String, required: true },
  dataType: { type: String, required: true, enum: ['market', 'chart'] },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

// Create compound index for efficient queries
PriceDataSchema.index({ coinId: 1, dataType: 1 });

export const PriceData = mongoose.model<IPriceData>('PriceData', PriceDataSchema); 