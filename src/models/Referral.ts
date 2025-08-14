
import mongoose, { Schema, Document } from 'mongoose';
import { type IUser } from './User';

export interface IReferral extends Document {
  user: IUser['_id'];
  referredUsers: IUser['_id'][];
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referredUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default mongoose.model<IReferral>('Referral', ReferralSchema);
