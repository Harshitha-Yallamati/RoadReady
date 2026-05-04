import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema(
  {
    id: { type: String, default: '' },
    url: { type: String, default: '' },
    thumbUrl: { type: String, default: '' },
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
    capturedAt: { type: Date, default: null },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      trim: true,
      default: 'assistant',
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      default: 'text',
      trim: true,
    },
    eventKey: {
      type: String,
      default: null,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    trafficLevel: {
      type: String,
      default: null,
    },
    suggestion: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: false },
);

const aiChatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.AIChatHistory || mongoose.model('AIChatHistory', aiChatHistorySchema);
