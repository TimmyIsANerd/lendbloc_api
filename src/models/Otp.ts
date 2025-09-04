import mongoose, { Schema, Document } from 'mongoose';

export interface IOtp extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  expiresAt: Date;
  createdAt: Date;
}

const OtpSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', unique: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, required: true },
});

export default mongoose.model<IOtp>('Otp', OtpSchema);
