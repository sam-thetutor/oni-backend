import mongoose from 'mongoose';
const PriceDataSchema = new mongoose.Schema({
    coinId: { type: String, required: true },
    dataType: { type: String, required: true, enum: ['market', 'chart'] },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
});
PriceDataSchema.index({ coinId: 1, dataType: 1 });
export const PriceData = mongoose.model('PriceData', PriceDataSchema);
//# sourceMappingURL=PriceData.js.map