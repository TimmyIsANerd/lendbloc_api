import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemSetting extends Document {
  key: string; // Singleton key, always 'GLOBAL'
  savingsApy: number; // Percentage value, e.g., 8.5 for 8.5%
  createdAt: Date;
  updatedAt: Date;
}

const SystemSettingSchema: Schema = new Schema(
  {
    key: { type: String, default: 'GLOBAL', unique: true, immutable: true },
    savingsApy: { type: Number, required: true, min: 0, max: 100, default: 5 },
  },
  { timestamps: true }
);

export default mongoose.model<ISystemSetting>('SystemSetting', SystemSettingSchema);
