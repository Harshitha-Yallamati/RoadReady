import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, required: true },
  lon: { type: Number, required: true }
}, { _id: false });

const routeDetailSchema = new mongoose.Schema({
  distance: Number,
  duration: Number,
  score: Number,
  estimatedCost: Number,
  summary: String,
  roadTypes: { highway: Number, urban: Number, rural: Number }
}, { _id: false });

const routeHistorySchema = new mongoose.Schema({
  source: { type: locationSchema, required: true },
  destination: { type: locationSchema, required: true },
  waypoints: [locationSchema],
  preference: {
    type: String,
    enum: ['fastest', 'cheapest', 'scenic', 'avoid_tolls'],
    default: 'fastest'
  },
  selectedRoute: routeDetailSchema,
  alternativeRoutes: [routeDetailSchema],
  weatherCondition: String,
  aiExplanation: String,
  createdAt: { type: Date, default: Date.now }
});

routeHistorySchema.index({ createdAt: -1 });
export default mongoose.model('RouteHistory', routeHistorySchema);
