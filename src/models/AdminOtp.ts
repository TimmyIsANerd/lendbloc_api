import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminOtp extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  expiresAt: Date;
}

const AdminOtpSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'Admin', unique: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 10 * 60 * 1000), index: { expires: '10m' } },
});

export default mongoose.model<IAdminOtp>('AdminOtp', AdminOtpSchema);
