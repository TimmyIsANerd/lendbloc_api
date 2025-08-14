import { Schema, model, Document } from 'mongoose';

export interface ITransaction extends Document {
  user: Schema.Types.ObjectId;
  type: 'deposit' | 'withdrawal' | 'loan-repayment' | 'interest-payment' | 'swap';
  amount: number;
  asset: string;
  status: 'pending' | 'completed' | 'failed';
  txHash?: string;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'loan-repayment', 'interest-payment', 'swap'], required: true },
  amount: { type: Number, required: true },
  asset: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  txHash: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default model<ITransaction>('Transaction', transactionSchema);
