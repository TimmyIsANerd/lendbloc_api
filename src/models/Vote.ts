import mongoose, { Schema, Document } from 'mongoose';

export interface IVote extends Document {
  userId: mongoose.Types.ObjectId;
  coinName: string;
  createdAt: Date;
}

const VoteSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    coinName: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IVote>('Vote', VoteSchema);
