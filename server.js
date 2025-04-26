// backend/server.js

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import transactionRoutes from './routes/transactionRoutes.js';
import userRoutes from './routes/userRoutes.js';
import cloudinaryRoutes from './routes/cloudinaryRoutes.js';

// Load environment variables
dotenv.config();

// Simple logger utility
const isProduction = process.env.NODE_ENV === 'production';
const logger = {
  log: (...args) => { if (!isProduction) console.log(...args); },
  error: (...args) => { if (!isProduction) console.error(...args); },
  warn: (...args) => { if (!isProduction) console.warn(...args); }
};

// Ensure required environment variables are set
if (!process.env.CLERK_SECRET_KEY) {
  logger.error('CLERK_SECRET_KEY is required but not set in environment variables');
  process.exit(1);
}

// Check for Cloudinary environment variables
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  logger.error('Cloudinary environment variables are required but not set');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.log('MongoDB connected successfully');
    } catch (error) {
        logger.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const app = express();
connectDB();

// Harden CORS settings for production
const corsOptions = isProduction
  ? { origin: process.env.FRONTEND_URL, credentials: true }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));
app.use(express.json());

// Protect admin routes
app.use('/api/users', ClerkExpressRequireAuth(), userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/cloudinary', ClerkExpressRequireAuth(), cloudinaryRoutes); // Protect Cloudinary routes

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.log(`Server is running on port ${PORT}`);
});
