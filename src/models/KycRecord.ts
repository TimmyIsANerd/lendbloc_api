import mongoose, { Schema, Document } from 'mongoose';

export enum KycStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum IdDocumentType {
  PASSPORT = 'passport',
  DRIVER_LICENSE = 'driver_license',
  NATIONAL_ID = 'national_id',
}

export enum AddressDocumentType {
  UTILITY_BILL = 'utility_bill',
  BANK_STATEMENT = 'bank_statement',
  RENTAL_AGREEMENT = 'rental_agreement',
}

export interface IKycRecord extends Document {
  userId: mongoose.Types.ObjectId;
  status: KycStatus;
  shuftiReferenceId?: string; // Shufti Pro reference ID
  shuftiEvent?: string; // Shufti Pro event (e.g., verification.accepted)
  shuftiVerificationResult?: string; // Shufti Pro verification_result (e.g., accepted, declined)
  shuftiDeclinedReason?: string; // Shufti Pro declined_reason
  idDocumentType?: IdDocumentType;
  idDocumentNumber?: string;
  idDocumentImageFront?: string; // URL from Shufti Pro proofs
  idDocumentImageBack?: string; // URL from Shufti Pro proofs
  faceScanImage?: string; // URL from Shufti Pro proofs
  addressDocumentType?: AddressDocumentType;
  addressDocumentImage?: string; // URL from Shufti Pro proofs
  rejectionReason?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: mongoose.Types.ObjectId;
  shuftiDocumentData?: object; // To store raw document_data from Shufti Pro
  shuftiAddressData?: object; // To store raw address_data from Shufti Pro
}

const KycRecordSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', unique: true },
    status: { type: String, enum: Object.values(KycStatus), default: KycStatus.PENDING },
    shuftiReferenceId: { type: String, unique: true, sparse: true }, // Make it unique and sparse for optional field
    shuftiEvent: { type: String },
    shuftiVerificationResult: { type: String },
    shuftiDeclinedReason: { type: String },
    idDocumentType: { type: String, enum: Object.values(IdDocumentType) },
    idDocumentNumber: { type: String },
    idDocumentImageFront: { type: String },
    idDocumentImageBack: { type: String },
    faceScanImage: { type: String },
    addressDocumentType: { type: String, enum: Object.values(AddressDocumentType) },
    addressDocumentImage: { type: String },
    rejectionReason: { type: String },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    shuftiDocumentData: { type: Object },
    shuftiAddressData: { type: Object },
  },
  { timestamps: true }
);

export default mongoose.model<IKycRecord>('KycRecord', KycRecordSchema);
