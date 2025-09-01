import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  name: string;
  symbol: string;
  iconUrl: string;
  currentPrice: number;
  marketCap: number;
  circulatingSupply: number;
  amountHeld: number;
  isLendable: boolean;
  isCollateral: boolean;
  // New optional fields for tokenized assets
  network?: string; // 'ETH' | 'BSC' | 'TRON' | 'MATIC' | 'BTC' | 'LTC'
  kind?: 'native' | 'erc20' | 'trc20';
  tokenAddress?: string;
  decimals?: number;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    symbol: { type: String, required: true, unique: true },
    iconUrl: { type: String, required: true },
    currentPrice: { type: Number, required: true },
    marketCap: { type: Number, required: true },
    circulatingSupply: { type: Number, required: true },
    amountHeld: { type: Number, required: true },
    isLendable: { type: Boolean, default: true },
    isCollateral: { type: Boolean, default: true },
    network: { type: String },
    kind: { type: String, enum: ['native', 'erc20', 'trc20'], default: 'native' },
    tokenAddress: { type: String },
    decimals: { type: Number },
  },
  { timestamps: true }
);

export default mongoose.model<IAsset>('Asset', AssetSchema);
