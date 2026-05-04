import mongoose from 'mongoose';

const trafficDataSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lon: { type: Number, required: true },
  lng: { type: Number },
  level: { type: String, enum: ['light', 'moderate', 'heavy'], default: 'light' },
  score: { type: Number, default: 0 },
  source: { type: String, enum: ['ml', 'simulator', 'manual', 'fallback'], default: 'ml' },
  routeId: String,
  congestionZone: {
    center: { lat: Number, lon: Number, lng: Number },
    radius: Number,
  },
  createdAt: { type: Date, default: Date.now, expires: 3600 }, // TTL: auto-delete after 1 hour
});

trafficDataSchema.pre('validate', function syncLngLon(next) {
  if (!Number.isFinite(this.lon) && Number.isFinite(this.lng)) {
    this.lon = this.lng;
  }
  if (!Number.isFinite(this.lng) && Number.isFinite(this.lon)) {
    this.lng = this.lon;
  }
  next();
});

trafficDataSchema.index({ lat: 1, lon: 1 });

export default mongoose.model('TrafficData', trafficDataSchema);
