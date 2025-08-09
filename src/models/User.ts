import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  title: string;
  fullName: string;
  dateOfBirth: string;
  email: string;
  socialIssuanceNumber: string;
  phoneNumber?: string;
  passwordHash: string;
  isKycVerified: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    fullName: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    socialIssuanceNumber: { type: String, required: true, unique: true },
    phoneNumber: { type: String, unique: true, sparse: true }, // sparse allows nulls to not violate unique constraint
    passwordHash: { type: String, required: true },
    isKycVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
