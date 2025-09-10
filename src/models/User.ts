import mongoose, { Schema, Document } from 'mongoose';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum AccountType {
  REG = 'REG',
  PRO = 'PRO',
}

export interface IUser extends Document {
  title?: string;
  fullName?: string;
  dateOfBirth?: string;
  email?: string;
  phoneNumber?: string;
  passwordHash?: string;
  kycReferenceId: string;
  referralId: string;
  isKycVerified: boolean;
  isEmailVerified: boolean;
  isPhoneNumberVerified: boolean;
  allowPasswordReset: boolean;
  allowEmailChange: boolean;
  accountStatus: AccountStatus;
  accountType: AccountType;
  blockedAt?: Date;
  blockedByAdminName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    title: { type: String, required: false },
    fullName: { type: String, required: false },
    dateOfBirth: { type: String, required: false },
    email: { type: String, required: false, unique: true, sparse: true },
    phoneNumber: { type: String, required: false, unique: true, sparse: true },
    passwordHash: { type: String, required: false },
    kycReferenceId: { type: String, unique: true, required: true },
    referralId: { type: String, unique: true, required: true },
    isKycVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneNumberVerified: { type: Boolean, default: false },
    allowPasswordReset: { type: Boolean, default: false },
    allowEmailChange: { type: Boolean, default: false },
    accountStatus: { type: String, enum: Object.values(AccountStatus), default: AccountStatus.ACTIVE },
    accountType: { type: String, enum: Object.values(AccountType), default: AccountType.REG },
    blockedAt: { type: Date },
    blockedByAdminName: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
