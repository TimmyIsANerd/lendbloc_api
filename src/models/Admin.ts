import mongoose, { Schema, Document } from 'mongoose';

export enum AdminRole {
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export interface IAdmin extends Document {
  fullName: string;
  username: string;
  email: string;
  secondaryEmail: string;
  phoneNumber: string;
  passwordHash: string;
  role: AdminRole;
  isEmailVerified: boolean;
  isPhoneNumberVerified: boolean;
  avatar?: string; // base64 data URL
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema: Schema = new Schema(
  {
    fullName: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, unique: true },
    secondaryEmail: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: Object.values(AdminRole), default: AdminRole.ADMIN },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneNumberVerified: { type: Boolean, default: false },
    avatar: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IAdmin>('Admin', AdminSchema);
