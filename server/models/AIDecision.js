import mongoose from 'mongoose';

const aiDecisionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  routeId: String,
  event: { type: String, enum: ['route_selected', 'traffic_detected', 'reroute_available', 'reroute_accepted', 'reroute_dismissed', 'chat'] },
  suggestion: String,
  geminiResponse: String,
  accepted: { type: Boolean, default: null },
  trafficLevel: String,
  trafficScore: Number,
  timeSaved: Number,
  createdAt: { type: Date, default: Date.now },
});

aiDecisionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('AIDecision', aiDecisionSchema);
