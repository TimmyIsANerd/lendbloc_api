import mongoose, { Schema, Document } from 'mongoose';

export enum KycStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface IKycRecord extends Document {
  userId: mongoose.Types.ObjectId;
  status: KycStatus;
  shuftiReferenceId?: string; // Shufti Pro reference ID
  shuftiEvent?: string; // Shufti Pro event (e.g., verification.accepted)
  shuftiVerificationResult?: any; // Shufti Pro verification_result (can be an object)
  shuftiDeclinedReason?: string; // Shufti Pro declined_reason
  rejectionReason?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  documentProof?: string;
  faceProof?: string;
  addressProof?: string;
  consentProof?: string;
  documentName?: string;
  documentDob?: string;
  fullAddress?: string;
  consentText?: string;
}

const KycRecordSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', unique: true },
    status: { type: String, enum: Object.values(KycStatus), default: KycStatus.PENDING },
    shuftiReferenceId: { type: String, unique: true, sparse: true }, // Make it unique and sparse for optional field
    shuftiEvent: { type: String },
    shuftiVerificationResult: { type: Schema.Types.Mixed },
    shuftiDeclinedReason: { type: String },
    rejectionReason: { type: String },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    documentProof: { type: String },
    faceProof: { type: String },
    addressProof: { type: String },
    consentProof: { type: String },
    documentName: { type: String },
    documentDob: { type: String },
    fullAddress: { type: String },
    consentText: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<IKycRecord>('KycRecord', KycRecordSchema);
