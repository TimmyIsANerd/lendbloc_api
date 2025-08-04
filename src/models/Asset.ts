import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  name: string;
  symbol: string;
  iconUrl: string;
  currentPrice: number;
  marketCap: number;
  circulatingSupply: number;
  isLendable: boolean;
  isCollateral: boolean;
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
    isLendable: { type: Boolean, default: true },
    isCollateral: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IAsset>('Asset', AssetSchema);
