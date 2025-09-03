import mongoose, { Schema, Document } from 'mongoose';

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  REPAID = 'REPAID',
  LIQUIDATED = 'LIQUIDATED',
}

export interface ILoan extends Document {
  userId: mongoose.Types.ObjectId;
  collateralAssetId: mongoose.Types.ObjectId;
  collateralAmount: number;
  loanAssetId: mongoose.Types.ObjectId;
  loanAmount: number;
  ltv: number;
  interestRate: number; // percent
  termDays: 7 | 30 | 180 | 365;
  status: LoanStatus;
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    collateralAssetId: { type: Schema.Types.ObjectId, required: true, ref: 'Asset' },
    collateralAmount: { type: Number, required: true },
    loanAssetId: { type: Schema.Types.ObjectId, required: true, ref: 'Asset' },
    loanAmount: { type: Number, required: true },
    ltv: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    termDays: { type: Number, enum: [7, 30, 180, 365], required: true },
    status: { type: String, enum: Object.values(LoanStatus), default: LoanStatus.ACTIVE },
  },
  { timestamps: true }
);

export default mongoose.model<ILoan>('Loan', LoanSchema);
