import mongoose, { Schema, Document } from 'mongoose';

export type QuoteStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';

export interface ILoanQuote extends Document {
  userId: mongoose.Types.ObjectId;
  borrowSymbol: string;
  borrowAssetId: mongoose.Types.ObjectId;
  borrowNetwork: 'ETH' | 'TRON';
  borrowAmount: number;
  collateralSymbol: string;
  collateralAssetId: mongoose.Types.ObjectId;
  targetLtvLoanToCollateral: number; // 0.5
  unitPricesUsd: { borrowUsd: number; collateralUsd: number };
  valuesUsd: { borrowUsd: number; collateralUsd: number };
  requiredCollateralAmountToken: number;
  marginCallLtv: number;
  liquidationLtv: number;
  marginCallCollateralValueUsd: number; // where call triggers given borrowAmount
  liquidationCollateralValueUsd: number;
  interestMonthlyPercent: number;
  interestMonthlyAmountToken: number; // simple interest for one month (borrow amount * rate)
  nextInterestAt: Date;
  originationFeePercent: number;
  originationFeeAmountToken: number;
  exposure: {
    equityUsd: number; // collateralUsd - borrowUsd
    distanceToMarginCallPercent: number; // how far collateral can drop before call
    marginCallPrice: number; // collateral price usd at call
    liquidationPrice: number; // collateral price usd at liquidation
  };
  status: QuoteStatus;
  createdAt: Date;
  updatedAt: Date;
}

const LoanQuoteSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    borrowSymbol: { type: String, required: true },
    borrowAssetId: { type: Schema.Types.ObjectId, required: true, ref: 'Asset' },
    borrowNetwork: { type: String, enum: ['ETH', 'TRON'], required: true },
    borrowAmount: { type: Number, required: true },
    collateralSymbol: { type: String, required: true },
    collateralAssetId: { type: Schema.Types.ObjectId, required: true, ref: 'Asset' },
    targetLtvLoanToCollateral: { type: Number, required: true },
    unitPricesUsd: { type: new Schema({ borrowUsd: Number, collateralUsd: Number }, { _id: false }), required: true },
    valuesUsd: { type: new Schema({ borrowUsd: Number, collateralUsd: Number }, { _id: false }), required: true },
    requiredCollateralAmountToken: { type: Number, required: true },
    marginCallLtv: { type: Number, required: true },
    liquidationLtv: { type: Number, required: true },
    marginCallCollateralValueUsd: { type: Number, required: true },
    liquidationCollateralValueUsd: { type: Number, required: true },
    interestMonthlyPercent: { type: Number, required: true },
    interestMonthlyAmountToken: { type: Number, required: true },
    nextInterestAt: { type: Date, required: true },
    originationFeePercent: { type: Number, required: true },
    originationFeeAmountToken: { type: Number, required: true },
    exposure: {
      type: new Schema(
        {
          equityUsd: Number,
          distanceToMarginCallPercent: Number,
          marginCallPrice: Number,
          liquidationPrice: Number,
        },
        { _id: false }
      ),
      required: true,
    },
    status: { type: String, enum: ['ACTIVE', 'USED', 'EXPIRED', 'CANCELLED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

LoanQuoteSchema.index({ userId: 1, status: 1, createdAt: -1 });

export default mongoose.model<ILoanQuote>('LoanQuote', LoanQuoteSchema);

