import mongoose, { Schema, Document } from 'mongoose';

export type RevenueType =
  | 'deposit-fee'
  | 'swap-fee'
  | 'origination-fee'
  | 'lending-interest'
  | 'withdrawal-fee'
  | 'interest-accrual';

export interface IRevenueEvent extends Document {
  type: RevenueType;
  assetId?: mongoose.Types.ObjectId | null;
  symbol?: string;
  network?: string;
  amountToken?: number;
  unitPriceUsd?: number;
  amountUsd: number;
  userId?: mongoose.Types.ObjectId | null;
  txId?: mongoose.Types.ObjectId | null;
  loanId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const RevenueEventSchema: Schema = new Schema(
  {
    type: { type: String, required: true, enum: ['deposit-fee','swap-fee','origination-fee','lending-interest','withdrawal-fee','interest-accrual'] },
    assetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
    symbol: { type: String },
    network: { type: String },
    amountToken: { type: Number },
    unitPriceUsd: { type: Number },
    amountUsd: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    txId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan' },
  },
  { timestamps: true }
);

RevenueEventSchema.index({ createdAt: 1 });
RevenueEventSchema.index({ type: 1, createdAt: 1 });

export default mongoose.model<IRevenueEvent>('RevenueEvent', RevenueEventSchema);