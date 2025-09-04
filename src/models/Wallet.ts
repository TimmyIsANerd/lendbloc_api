import mongoose, { Schema, Document } from 'mongoose';

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  assetId: mongoose.Types.ObjectId;
  address: string;
  balance: number;
  encryptedMnemonic: string;
  network: string; // BSC, ETH, TRON, BTC
  isLiquidityWallet: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    assetId: { type: Schema.Types.ObjectId, required: true, ref: 'Asset' },
    address: { type: String, required: true, unique: true },
    balance: { type: Number, required: true, default: 0 },
    encryptedMnemonic: { type: String, required: true },
    isLiquidityWallet: { type: Boolean, default: false },
    network: { type: String, required: true, enum: ['BSC', 'ETH', 'TRON', 'BTC', 'LTC'] }
  },
  { timestamps: true }
);

export default mongoose.model<IWallet>('Wallet', WalletSchema);
