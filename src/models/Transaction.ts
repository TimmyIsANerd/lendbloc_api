import { Schema, model, Document } from 'mongoose';

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'loan-repayment'
  | 'interest-payment'
  | 'interest-accrual'
  | 'loan-disbursement'
  | 'liquidation'
  | 'margin-call'
  | 'swap'
  | 'relocation';

export interface ITransaction extends Document {
  user: Schema.Types.ObjectId;
  type: TransactionType;
  amount: number; // net amount (kept for backward-compat)
  asset: string;
  status: 'pending' | 'completed' | 'failed' | 'confirmed' | 'relocated';
  txHash?: string;
  network?: string;
  contractAddress?: string;
  // Audit fields
  grossAmount?: number;   // amount before fees
  netAmount?: number;     // amount after fees (should equal 'amount')
  feePercent?: number;    // applied fee percent
  feeAmount?: number;     // grossAmount - netAmount
  // Swap details (when type === 'swap')
  swapDetails?: {
    fromAssetId?: Schema.Types.ObjectId;
    toAssetId?: Schema.Types.ObjectId;
    fromSymbol?: string;
    toSymbol?: string;
    fromAmountToken?: number;
    toAmountToken?: number;
    fromAmountUsd?: number;
    toAmountUsd?: number;
    fromFeePercent?: number;
    toFeePercent?: number;
    fromFeeAmountToken?: number;
    toFeeAmountToken?: number;
    rateFromUsd?: number;
    rateToUsd?: number;
  };
  // Loan relations (optional)
  loanId?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const swapDetailsSchema = new Schema({
  fromAssetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
  toAssetId: { type: Schema.Types.ObjectId, ref: 'Asset' },
  fromSymbol: { type: String },
  toSymbol: { type: String },
  fromAmountToken: { type: Number },
  toAmountToken: { type: Number },
  fromAmountUsd: { type: Number },
  toAmountUsd: { type: Number },
  fromFeePercent: { type: Number },
  toFeePercent: { type: Number },
  fromFeeAmountToken: { type: Number },
  toFeeAmountToken: { type: Number },
  rateFromUsd: { type: Number },
  rateToUsd: { type: Number },
}, { _id: false });

const transactionSchema = new Schema<ITransaction>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit','withdrawal','loan-repayment','interest-payment','interest-accrual','loan-disbursement','liquidation','margin-call','swap','relocation'], required: true },
  amount: { type: Number, required: true },
  asset: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'confirmed', 'relocated'], default: 'pending' },
  txHash: { type: String },
  network: { type: String },
  contractAddress: { type: String },
  // Audit fields
  grossAmount: { type: Number },
  netAmount: { type: Number },
  feePercent: { type: Number },
  feeAmount: { type: Number },
  swapDetails: { type: swapDetailsSchema },
  loanId: { type: Schema.Types.ObjectId, ref: 'Loan' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Ensure txHash is unique only when present as a string
transactionSchema.index(
  { txHash: 1 },
  { unique: true, partialFilterExpression: { txHash: { $exists: true, $type: 'string' } } }
);

export default model<ITransaction>('Transaction', transactionSchema);
