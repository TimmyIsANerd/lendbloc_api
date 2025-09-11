import mongoose, { Schema, Document } from 'mongoose';

export interface ISavingsEarning extends Document {
  userId: mongoose.Types.ObjectId;
  assetId: mongoose.Types.ObjectId;
  savingsAccountId: mongoose.Types.ObjectId;
  amount: number;
  apy: number; // percent at time of accrual
  termDays: number;
  accruedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SavingsEarningSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset', required: true },
    savingsAccountId: { type: Schema.Types.ObjectId, ref: 'SavingsAccount', required: true },
    amount: { type: Number, required: true },
    apy: { type: Number, required: true },
    termDays: { type: Number, required: true },
    accruedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

SavingsEarningSchema.index({ savingsAccountId: 1, accruedAt: 1 });

export default mongoose.model<ISavingsEarning>('SavingsEarning', SavingsEarningSchema);
