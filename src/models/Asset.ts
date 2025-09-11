import mongoose, { Schema, Document } from 'mongoose';

export type AssetStatus = 'LISTED' | 'PENDING_VOTES' | 'DELISTED';
export type Network = 'ETH' | 'BSC' | 'TRON' | 'BTC' | 'LTC';
export type AssetKind = 'native' | 'erc20' | 'trc20';
export type TermKey = 'd7' | 'd30' | 'd180' | 'd365';

export interface TermInterest {
  d7: number; // percent
  d30: number; // percent
  d180: number; // percent
  d365: number; // percent
}

export interface IAsset extends Document {
  name: string;
  symbol: string;
  iconUrl: string; // remote URL
  currentPrice: number;
  marketCap: number;
  circulatingSupply: number;
  amountHeld: number;
  isLendable: boolean;
  isCollateral: boolean;
  network: Network; // constrained to Wallet networks
  kind: AssetKind; // native or tokenized
  tokenAddress?: string; // set for tokens
  decimals?: number; // set for tokens
  status: AssetStatus;
  fees: {
    loanInterest: {
      REG: TermInterest;
      PRO: TermInterest;
    };
    savingsInterest: {
      REG: TermInterest;
      PRO: TermInterest;
    };
    sendFeePercent: { REG: number; PRO: number };
    receiveFeePercent: { REG: number; PRO: number };
    exchangeFeePercentFrom: { REG: number; PRO: number };
    exchangeFeePercentTo: { REG: number; PRO: number };
    referralFeePercent: { REG: number; PRO: number };
  };
  createdAt: Date;
  updatedAt: Date;
}

const defaultTermInterest: TermInterest = { d7: 0, d30: 0, d180: 0, d365: 0 };
const defaultSplitPercent = { REG: 0, PRO: 0 };

const AssetSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    iconUrl: { type: String, required: true },
    currentPrice: { type: Number, required: true },
    marketCap: { type: Number, required: true },
    circulatingSupply: { type: Number, required: true },
    amountHeld: { type: Number, required: true },
    isLendable: { type: Boolean, default: true },
    isCollateral: { type: Boolean, default: true },
    network: { type: String, required: true, enum: ['ETH', 'BSC', 'TRON', 'BTC', 'LTC'] },
    kind: { type: String, enum: ['native', 'erc20', 'trc20'], default: 'native' },
    tokenAddress: { type: String },
    decimals: { type: Number },
    status: { type: String, enum: ['LISTED', 'PENDING_VOTES', 'DELISTED'], default: 'LISTED' },
    fees: {
      type: new Schema(
        {
          loanInterest: {
            type: new Schema(
              {
                REG: {
                  type: new Schema(
                    {
                      d7: { type: Number, default: 0 },
                      d30: { type: Number, default: 0 },
                      d180: { type: Number, default: 0 },
                      d365: { type: Number, default: 0 },
                    },
                    { _id: false }
                  ),
                  required: true,
                  default: defaultTermInterest,
                },
                PRO: {
                  type: new Schema(
                    {
                      d7: { type: Number, default: 0 },
                      d30: { type: Number, default: 0 },
                      d180: { type: Number, default: 0 },
                      d365: { type: Number, default: 0 },
                    },
                    { _id: false }
                  ),
                  required: true,
                  default: defaultTermInterest,
                },
              },
              { _id: false }
            ),
            required: true,
            default: { REG: defaultTermInterest, PRO: defaultTermInterest },
          },
          savingsInterest: {
            type: new Schema(
              {
                REG: {
                  type: new Schema(
                    {
                      d7: { type: Number, default: 0 },
                      d30: { type: Number, default: 0 },
                      d180: { type: Number, default: 0 },
                      d365: { type: Number, default: 0 },
                    },
                    { _id: false }
                  ),
                  required: true,
                  default: defaultTermInterest,
                },
                PRO: {
                  type: new Schema(
                    {
                      d7: { type: Number, default: 0 },
                      d30: { type: Number, default: 0 },
                      d180: { type: Number, default: 0 },
                      d365: { type: Number, default: 0 },
                    },
                    { _id: false }
                  ),
                  required: true,
                  default: defaultTermInterest,
                },
              },
              { _id: false }
            ),
            required: true,
            default: { REG: defaultTermInterest, PRO: defaultTermInterest },
          },
          sendFeePercent: {
            type: new Schema({ REG: { type: Number, default: 0 }, PRO: { type: Number, default: 0 } }, { _id: false })
          },
          receiveFeePercent: {
            type: new Schema({ REG: { type: Number, default: 0 }, PRO: { type: Number, default: 0 } }, { _id: false })
          },
          exchangeFeePercentFrom: {
            type: new Schema({ REG: { type: Number, default: 0 }, PRO: { type: Number, default: 0 } }, { _id: false })
          },
          exchangeFeePercentTo: {
            type: new Schema({ REG: { type: Number, default: 0 }, PRO: { type: Number, default: 0 } }, { _id: false })
          },
          referralFeePercent: {
            type: new Schema({ REG: { type: Number, default: 0 }, PRO: { type: Number, default: 0 } }, { _id: false })
          },
        },
        { _id: false }
      ),
      required: true,
      default: {
        loanInterest: { REG: defaultTermInterest, PRO: defaultTermInterest },
        savingsInterest: { REG: defaultTermInterest, PRO: defaultTermInterest },
        sendFeePercent: defaultSplitPercent,
        receiveFeePercent: defaultSplitPercent,
        exchangeFeePercentFrom: defaultSplitPercent,
        exchangeFeePercentTo: defaultSplitPercent,
        referralFeePercent: defaultSplitPercent,
      },
    },
  },
  { timestamps: true }
);

// Compound uniqueness
// Token assets: unique by tokenAddress + network (only for docs where tokenAddress is set)
AssetSchema.index({ tokenAddress: 1, network: 1 }, {
  unique: true,
  partialFilterExpression: { tokenAddress: { $exists: true, $type: 'string' } },
});

// Native assets: unique by symbol + network (only for docs where tokenAddress does not exist)
AssetSchema.index({ symbol: 1, network: 1 }, {
  unique: true,
  partialFilterExpression: { tokenAddress: { $exists: false } },
});

export default mongoose.model<IAsset>('Asset', AssetSchema);
