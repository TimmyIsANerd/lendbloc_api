import mongoose, { Schema, Document } from 'mongoose';

export type SavingsStatus = 'ACTIVE' | 'CLOSED';

export interface ISavingsAccount extends Document {
  userId: mongoose.Types.ObjectId;
  assetId: mongoose.Types.ObjectId;
  balance: number;
  apy: number; // percent copied from asset fees at creation
  termDays: 7 | 30 | 180 | 365;
  lockStartAt: Date;
  lockEndAt: Date;
  lastPayoutAt: Date; // tracks the last monthly payout date
  status: SavingsStatus; // ACTIVE or CLOSED
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SavingsAccountSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    assetId: { type: Schema.Types.ObjectId, required: true, ref: 'Asset' },
    balance: { type: Number, required: true, default: 0 },
    apy: { type: Number, required: true },
    termDays: { type: Number, enum: [7, 30, 180, 365], required: true },
    lockStartAt: { type: Date, required: true },
    lockEndAt: { type: Date, required: true },
    lastPayoutAt: { type: Date, required: true, default: () => new Date() },
    status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE', required: true },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

// Enforce one ACTIVE savings account per user+asset
SavingsAccountSchema.index(
  { userId: 1, assetId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } as any }
);

export default mongoose.model<ISavingsAccount>('SavingsAccount', SavingsAccountSchema);
