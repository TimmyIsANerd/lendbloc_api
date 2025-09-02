import mongoose, { Schema, Document } from 'mongoose';
import { AdminRole } from './Admin';

export interface IAdminInvite extends Document {
  email: string;
  role: AdminRole;
  token: string;
  expiresAt: Date;
  invitedBy: mongoose.Types.ObjectId;
  accepted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdminInviteSchema: Schema = new Schema(
  {
    email: { type: String, required: true, index: true },
    role: { type: String, enum: Object.values(AdminRole), default: AdminRole.ADMIN },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    accepted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IAdminInvite>('AdminInvite', AdminInviteSchema);
