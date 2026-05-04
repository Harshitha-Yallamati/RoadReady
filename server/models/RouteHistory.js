import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
  },
  { _id: false },
);

const routeDetailSchema = new mongoose.Schema(
  {
    distance: Number,
    duration: Number,
    adjustedDuration: Number,
    score: Number,
    estimatedCost: Number,
    summary: String,
    trafficLevel: String,
    trafficScore: Number,
    trafficDelay: Number,
    roadTypes: {
      highway: Number,
      urban: Number,
      rural: Number,
    },
  },
  { _id: false },
);

const routeHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: { type: locationSchema, required: true },
    destination: { type: locationSchema, required: true },
    waypoints: [locationSchema],
    preference: {
      type: String,
      enum: ['fastest', 'shortest', 'cheapest', 'scenic', 'avoid_tolls', 'avoid_highways'],
      default: 'fastest',
    },
    selectedRoute: routeDetailSchema,
    alternativeRoutes: [routeDetailSchema],
    weatherCondition: String,
    aiExplanation: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

routeHistorySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.RouteHistory || mongoose.model('RouteHistory', routeHistorySchema);
