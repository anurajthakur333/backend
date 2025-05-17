// backend/server.js

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import transactionRoutes from './routes/transactionRoutes.js';
import userRoutes from './routes/userRoutes.js';
import cloudinaryRoutes from './routes/cloudinaryRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Simplified CORS configuration
app.use(cors({
  origin: isProduction ? process.env.FRONTEND_URL : 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Check required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'CLERK_SECRET_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.get('/', (req, res) => res.json({ message: 'SellMyPi API is running!' }));
app.get('/health', (req, res) => res.json({ status: 'healthy' }));

// Log Authorization header for every request (for debugging Clerk auth issues)
app.use((req, res, next) => {
  console.log('Authorization header:', req.headers.authorization);
  next();
});

// API routes
app.use('/api/users', ClerkExpressRequireAuth(), userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/cloudinary', ClerkExpressRequireAuth(), cloudinaryRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
