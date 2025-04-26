import mongoose from "mongoose";

const userInfoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    status: { type: String, required: true, default: 'pending', enum: ['pending', 'approved', 'rejected', 'completed', 'processing']},
    userInfo: { type: userInfoSchema, required: true },
    upiId: { type: String, required: true },
    piAmount: { type: Number, required: true },
    usdValue: { type: String, required: true },
    inrValue: { type: String, required: true },
    SellRateUsd: { type: String, required: true },
    SellRateInr: { type: String, required: true },
    imageUrl: { type: String, required: true },
  },
  {
    versionKey: false, // Disable the version key (__v)
    timestamps: true,
  }
);

// Create index on userInfo.id for efficient queries
transactionSchema.index({ "userInfo.id": 1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);