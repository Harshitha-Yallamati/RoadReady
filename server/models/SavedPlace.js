import mongoose from 'mongoose';

const savedPlaceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    lat: {
      type: Number,
      required: true,
    },
    lon: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
    },
    address: {
      type: String,
      default: '',
      trim: true,
      maxlength: 240,
    },
    category: {
      type: String,
      enum: ['home', 'work', 'favorite', 'food', 'scenic', 'other'],
      default: 'favorite',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

savedPlaceSchema.pre('validate', function syncLngLon(next) {
  if (!Number.isFinite(this.lon) && Number.isFinite(this.lng)) {
    this.lon = this.lng;
  }
  if (!Number.isFinite(this.lng) && Number.isFinite(this.lon)) {
    this.lng = this.lon;
  }
  next();
});

savedPlaceSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.SavedPlace || mongoose.model('SavedPlace', savedPlaceSchema);
