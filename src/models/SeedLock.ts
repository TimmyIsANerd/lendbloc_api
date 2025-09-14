import mongoose, { Schema, Document } from 'mongoose';

export interface ISeedLock extends Document {
  key: string;        // e.g., 'prod-demo-v1'
  version: string;    // e.g., 'v1'
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SeedLockSchema: Schema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    version: { type: String, required: true },
    appliedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

SeedLockSchema.index({ key: 1 }, { unique: true });

export default mongoose.model<ISeedLock>('SeedLock', SeedLockSchema);
