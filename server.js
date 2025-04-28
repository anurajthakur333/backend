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
  log: (...args) => { console.log(...args); },
  error: (...args) => { console.error(...args); },
  warn: (...args) => { console.warn(...args); }
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

// Validate MongoDB URI
if (!process.env.MONGODB_URI) {
  logger.error('MONGODB_URI is required but not set in environment variables');
  process.exit(1);
}

// Validate MongoDB URI format
const validateMongoDbUri = (uri) => {
  const standardFormat = /^mongodb:\/\/.+/;
  const srvFormat = /^mongodb\+srv:\/\/.+/;
  
  if (!standardFormat.test(uri) && !srvFormat.test(uri)) {
    logger.error('Invalid MONGODB_URI format. Must start with mongodb:// or mongodb+srv://');
    return false;
  }
  
  // Minimal validation to catch obvious errors
  if (uri.includes('!') || uri.includes(' ')) {
    logger.error('MONGODB_URI contains invalid characters');
    return false;
  }
  
  return true;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create the Express app
const app = express();

// Database connection with retry mechanism and better error handling
const connectDB = async (retries = 5, interval = 5000) => {
    let connectionAttempt = 0;
    
    // Validate the URI before attempting connection
    if (!validateMongoDbUri(process.env.MONGODB_URI)) {
      logger.error('MongoDB connection failed: Invalid connection string format');
      logger.error('Example formats:');
      logger.error('  - Standard: mongodb://username:password@hostname:port/database');
      logger.error('  - Atlas: mongodb+srv://username:password@cluster.mongodb.net/database');
      process.exit(1);
    }
    
    while (connectionAttempt < retries) {
        try {
            await mongoose.connect(process.env.MONGODB_URI, {
                // These options help with connection stability
                // and are recommended for production
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            logger.log('MongoDB connected successfully');
            return;
        } catch (error) {
            connectionAttempt++;
            
            // Provide more specific error messages based on the error type
            if (error.name === 'MongoServerSelectionError') {
                logger.error(`MongoDB server selection failed (attempt ${connectionAttempt}/${retries}): ${error.message}`);
                logger.error('This usually means the MongoDB server is unreachable. Check your connection string and network.');
            } else if (error.name === 'MongoParseError') {
                logger.error(`MongoDB connection string parse error: ${error.message}`);
                logger.error('Your MONGODB_URI environment variable is likely malformed.');
                // Exit immediately for connection string errors since retrying won't help
                process.exit(1);
            } else {
                logger.error(`MongoDB connection attempt ${connectionAttempt} failed: ${error.message}`);
            }
            
            if (connectionAttempt >= retries) {
                logger.error('Maximum MongoDB connection attempts reached. Exiting...');
                process.exit(1);
            }
            
            logger.log(`Retrying in ${interval / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
};

// Harden CORS settings for production
const corsOptions = isProduction
  ? { origin: process.env.FRONTEND_URL, credentials: true }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'SellMyPi API is running!' });
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/users', ClerkExpressRequireAuth(), userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/cloudinary', ClerkExpressRequireAuth(), cloudinaryRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  const statusCode = err.statusCode || 500;
  const response = {
    error: err.name || 'Internal Server Error',
    message: err.message || 'Something went wrong',
    status: statusCode
  };
  
  // Only include stack trace in development
  if (!isProduction) {
    response.stack = err.stack;
  }
  
  res.status(statusCode).json(response);
});

// Start server
let server;
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    
    server = app.listen(PORT, () => {
      logger.log(`Server is running on port ${PORT}`);
      logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Trying again...`);
        setTimeout(() => {
          server.close();
          server.listen(PORT);
        }, 1000);
      } else {
        process.exit(1);
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.log(`Received ${signal}. Shutting down gracefully...`);
  
  if (server) {
    server.close(() => {
      logger.log('HTTP server closed.');
      
      // Close MongoDB connection
      mongoose.connection.close(false, () => {
        logger.log('MongoDB connection closed.');
        process.exit(0);
      });
      
      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    });
  } else {
    process.exit(0);
  }
};

// Handle process events
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Continue running in this case, but log the event
});

// Start the server
startServer();
