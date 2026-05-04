// ============================================================
// AI Smart Router Planner — Server Entry Point
// ============================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import connectDB from './config/db.js';
import routeRoutes from './routes/routeRoutes.js';
import historyRoutes from './routes/historyRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import savedPlacesRoutes from './routes/savedPlacesRoutes.js';
import trafficRoutes from './routes/trafficRoutes.js';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// ── Routes ──
app.use('/api/routes', routeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/saved', savedPlacesRoutes);
app.use('/api/traffic', trafficRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'AI Smart Router Planner API is running 🚀',
    timestamp: new Date().toISOString(),
    mode: process.env.ORS_API_KEY ? 'live' : 'mock'
  });
});

// ── Error Handler ──
app.use(errorHandler);

// ── Start Server ──
async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 AI Smart Router Planner API`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Mode: ${process.env.ORS_API_KEY ? '🌐 Live API' : '🔧 Mock Data'}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);
  });
}

start();
