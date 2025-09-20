import mongoose, { Schema, Document } from 'mongoose';

export interface IRevenueDaily extends Document {
  dateStr: string; // yyyy-MM-dd
  totalUsd: number;
  byType: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const RevenueDailySchema: Schema = new Schema(
  {
    dateStr: { type: String, required: true, unique: true },
    totalUsd: { type: Number, required: true, default: 0 },
    byType: { type: Object, required: true, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model<IRevenueDaily>('RevenueDaily', RevenueDailySchema);
