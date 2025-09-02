import mongoose, { Schema, Document } from 'mongoose';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export interface IUser extends Document {
  title: string;
  fullName: string;
  dateOfBirth: string;
  email: string;
  phoneNumber: string;
  passwordHash: string;
  kycReferenceId: string;
  referralId: string;
  isKycVerified: boolean;
  isEmailVerified: boolean;
  isPhoneNumberVerified: boolean;
  allowPasswordReset: boolean;
  allowEmailChange: boolean;
  accountStatus: AccountStatus;
  blockedAt?: Date;
  blockedByAdminName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    fullName: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    kycReferenceId: { type: String, unique: true, required: true },
    referralId: { type: String, unique: true, required: true },
    isKycVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneNumberVerified: { type: Boolean, default: false },
    allowPasswordReset: { type: Boolean, default: false },
    allowEmailChange: { type: Boolean, default: false },
    accountStatus: { type: String, enum: Object.values(AccountStatus), default: AccountStatus.ACTIVE },
    blockedAt: { type: Date },
    blockedByAdminName: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
