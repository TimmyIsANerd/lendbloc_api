
import mongoose, { Schema, Document } from 'mongoose';
import { IReferral } from './Referral';
import { IUser } from './User';

export interface IEarning extends Document {
  referral: IReferral['_id'];
  referredUser: IUser['_id'];
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

const EarningSchema: Schema = new Schema(
  {
    referral: { type: Schema.Types.ObjectId, ref: 'Referral', required: true },
    referredUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IEarning>('Earning', EarningSchema);
