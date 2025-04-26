import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Simple logger utility
const isProduction = process.env.NODE_ENV === 'production';
const logger = {
  log: (...args) => { if (!isProduction) console.log(...args); },
  error: (...args) => { if (!isProduction) console.error(...args); },
  warn: (...args) => { if (!isProduction) console.warn(...args); }
};

// Validate Cloudinary credentials
const requiredEnvVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required Cloudinary environment variables: ${missingEnvVars.join(', ')}`);
}

// Configure Cloudinary with credentials
const config = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
  api_key: process.env.CLOUDINARY_API_KEY.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET.trim()
};

// Log configuration (without sensitive data)
logger.log('Cloudinary Configuration:', {
  cloud_name: config.cloud_name,
  api_key: config.api_key ? '****' : undefined,
  api_secret: config.api_secret ? '****' : undefined
});

// Initialize Cloudinary
cloudinary.config(config);

// Export the configured instance
export default cloudinary; 