import mongoose, { Schema, Document } from 'mongoose';

export interface IUserBalance extends Document {
  userId: mongoose.Types.ObjectId;
  assetId: mongoose.Types.ObjectId;
  balance: number; // total liquid balance available to user (excluding locked)
  locked: number;  // amount locked (savings, collateral, etc.)
  createdAt: Date;
  updatedAt: Date;
}

const UserBalanceSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    assetId: { type: Schema.Types.ObjectId, required: true, ref: 'Asset' },
    balance: { type: Number, required: true, default: 0 },
    locked: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

UserBalanceSchema.index({ userId: 1, assetId: 1 }, { unique: true });

export default mongoose.model<IUserBalance>('UserBalance', UserBalanceSchema);

