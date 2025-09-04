import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminChatMessage extends Document {
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminChatMessageSchema: Schema = new Schema(
  {
    senderId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    text: { type: String, required: true, maxlength: 5000 },
  },
  { timestamps: true }
);

AdminChatMessageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });

export default mongoose.model<IAdminChatMessage>('AdminChatMessage', AdminChatMessageSchema);

