import mongoose, { Schema, Document } from 'mongoose';

export enum LoanStatus {
  PENDING_COLLATERAL = 'PENDING_COLLATERAL',
  ACTIVE = 'ACTIVE',
  REPAID = 'REPAID',
  CANCELLED = 'CANCELLED',
  LIQUIDATED = 'LIQUIDATED',
}

export type PayoutMethod = 'INTERNAL' | 'EXTERNAL';

export interface ILoan extends Document {
  userId: mongoose.Types.ObjectId;
  // Borrow side
  loanAssetId: mongoose.Types.ObjectId;
  loanAmount: number; // principal (token units)
  borrowNetwork: 'ETH' | 'TRON';
  interestRate: number; // monthly percent
  nextInterestAt?: Date;
  // Collateral side
  collateralAssetId: mongoose.Types.ObjectId;
  expectedCollateralAmountToken: number; // tokens expected by quote
  collateralReceivedAmountToken?: number; // tokens actually received
  collateralWalletId?: mongoose.Types.ObjectId | null;
  collateralReceivingAddress?: string;
  // Ratios and risk
  targetLtvLoanToCollateral: number; // e.g., 0.5
  marginCallLtv?: number; // loan/collateral threshold
  liquidationLtv?: number; // loan/collateral threshold
  // Snapshots at origination
  unitPricesAtOrigination?: { borrowUsd: number; collateralUsd: number };
  valuesAtOrigination?: { borrowUsd: number; collateralUsd: number };
  // Fees
  originationFeePercent: number;
  originationFeeAmountToken: number;
  // Payout settings
  payoutMethod: PayoutMethod;
  payoutAddress?: string;
  // Alerts configuration (per-loan)
  alerts?: {
    interest?: { thresholds: number[] }; // allowed: 25,50,75,90
    collateral?: { dipping?: boolean; thresholds?: number[] }; // allowed: -25,-50,-75,-90
  };
  // Lifecycle
  quoteId?: mongoose.Types.ObjectId | null;
  status: LoanStatus;
  disbursedAt?: Date;
  cancelledAt?: Date;
  expiresAt?: Date; // deadline for collateral arrival
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    loanAssetId: { type: Schema.Types.ObjectId, required: true, ref: 'Asset' },
    loanAmount: { type: Number, required: true },
    borrowNetwork: { type: String, enum: ['ETH', 'TRON'], required: true },
    interestRate: { type: Number, required: true },
    nextInterestAt: { type: Date },

    collateralAssetId: { type: Schema.Types.ObjectId, required: true, ref: 'Asset' },
    expectedCollateralAmountToken: { type: Number, required: true },
    collateralReceivedAmountToken: { type: Number, default: 0 },
    collateralWalletId: { type: Schema.Types.ObjectId, ref: 'Wallet', default: null },
    collateralReceivingAddress: { type: String },

    targetLtvLoanToCollateral: { type: Number, required: true },
    marginCallLtv: { type: Number },
    liquidationLtv: { type: Number },

    unitPricesAtOrigination: { type: new Schema({ borrowUsd: Number, collateralUsd: Number }, { _id: false }) },
    valuesAtOrigination: { type: new Schema({ borrowUsd: Number, collateralUsd: Number }, { _id: false }) },

    originationFeePercent: { type: Number, required: true },
    originationFeeAmountToken: { type: Number, required: true },

    payoutMethod: { type: String, enum: ['INTERNAL', 'EXTERNAL'], required: true },
    payoutAddress: { type: String },

    alerts: {
      type: new Schema(
        {
          interest: {
            type: new Schema(
              {
                thresholds: { type: [Number], default: [] },
              },
              { _id: false }
            ),
            default: { thresholds: [] },
          },
          collateral: {
            type: new Schema(
              {
                dipping: { type: Boolean, default: false },
                thresholds: { type: [Number], default: [] },
              },
              { _id: false }
            ),
            default: { dipping: false, thresholds: [] },
          },
        },
        { _id: false }
      ),
      default: { interest: { thresholds: [] }, collateral: { dipping: false, thresholds: [] } },
    },

    quoteId: { type: Schema.Types.ObjectId, ref: 'LoanQuote', default: null },
    status: { type: String, enum: Object.values(LoanStatus), default: LoanStatus.PENDING_COLLATERAL },
    disbursedAt: { type: Date },
    cancelledAt: { type: Date },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

LoanSchema.index({ userId: 1, status: 1 });
LoanSchema.index({ collateralWalletId: 1 });

export default mongoose.model<ILoan>('Loan', LoanSchema);
