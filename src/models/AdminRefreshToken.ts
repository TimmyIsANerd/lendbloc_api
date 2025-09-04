import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
}

const AdminRefreshTokenSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'Admin' },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

export default mongoose.model<IAdminRefreshToken>('AdminRefreshToken', AdminRefreshTokenSchema);
