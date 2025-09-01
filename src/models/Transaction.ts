import { Schema, model, Document } from 'mongoose';

export interface ITransaction extends Document {
  user: Schema.Types.ObjectId;
  type: 'deposit' | 'withdrawal' | 'loan-repayment' | 'interest-payment' | 'swap' | 'relocation';
  amount: number;
  asset: string;
  status: 'pending' | 'completed' | 'failed' | 'confirmed' | 'relocated';
  txHash?: string;
  network?: string;
  contractAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'loan-repayment', 'interest-payment', 'swap', 'relocation'], required: true },
  amount: { type: Number, required: true },
  asset: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'confirmed', 'relocated'], default: 'pending' },
  txHash: { type: String, unique:true },
  network: { type: String },
  contractAddress: { type: String },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default model<ITransaction>('Transaction', transactionSchema);
