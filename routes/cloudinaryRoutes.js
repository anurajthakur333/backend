import express from 'express';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

// Simple logger utility
const isProduction = process.env.NODE_ENV === 'production';
const logger = {
  log: (...args) => { if (!isProduction) console.log(...args); },
  error: (...args) => { if (!isProduction) console.error(...args); },
  warn: (...args) => { if (!isProduction) console.warn(...args); }
};

/**
 * Extract public_id and cloud_name from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {{ public_id: string|null, cloud_name: string|null }} - Extracted values
 */
const extractCloudinaryInfo = (url) => {
  try {
    if (!url) return { public_id: null, cloud_name: null };
    
    if (url.includes('cloudinary.com')) {
      // Extract cloud name from URL
      const cloudNameMatch = url.match(/cloudinary\.com\/([^/]+)/);
      const cloudName = cloudNameMatch ? cloudNameMatch[1] : null;

      // Improved public_id extraction (handles folders and transformations)
      const publicIdMatch = url.match(/\/upload\/(?:[^/]+\/)*v\d+\/(.+?)\.[^.]+$/);
      const publicId = publicIdMatch ? publicIdMatch[1] : null;

      return { public_id: publicId, cloud_name: cloudName };
    }
    
    // If it's already a public_id, return it without cloud name
    return { public_id: url, cloud_name: null };
  } catch (error) {
    logger.error('Error extracting Cloudinary info:', error);
    return { public_id: null, cloud_name: null };
  }
};

/**
 * @route   POST /api/cloudinary/delete
 * @desc    Delete an image from Cloudinary
 * @access  Private
 */
router.post('/delete', async (req, res) => {
  try {
    const { public_id, imageUrl } = req.body;
    logger.log('Received delete request:', { public_id, imageUrl });

    // Extract information from URL or use provided public_id
    const { public_id: extractedPublicId, cloud_name: urlCloudName } = extractCloudinaryInfo(imageUrl);
    const finalPublicId = public_id || extractedPublicId;

    if (!finalPublicId) {
      logger.error('Invalid public_id or imageUrl:', { public_id, imageUrl });
      return res.status(400).json({ 
        success: false, 
        message: 'Valid public_id or imageUrl is required',
        received: { public_id, imageUrl }
      });
    }

    // Verify Cloudinary configuration
    const currentConfig = cloudinary.config();
    if (!currentConfig.cloud_name || !currentConfig.api_key || !currentConfig.api_secret) {
      logger.error('Cloudinary configuration missing:', { 
        hasCloudName: !!currentConfig.cloud_name,
        hasApiKey: !!currentConfig.api_key,
        hasApiSecret: !!currentConfig.api_secret
      });
      return res.status(500).json({
        success: false,
        message: 'Cloudinary configuration error'
      });
    }

    // Validate cloud name if URL is provided
    if (urlCloudName && urlCloudName !== currentConfig.cloud_name) {
      logger.error('Cloud name mismatch:', {
        urlCloudName,
        configCloudName: currentConfig.cloud_name
      });
      return res.status(400).json({
        success: false,
        message: 'Cloud name mismatch between URL and configuration',
        details: {
          urlCloudName,
          configCloudName: currentConfig.cloud_name
        }
      });
    }

    logger.log('Attempting to delete image with public_id:', finalPublicId);
    logger.log('Using Cloudinary cloud_name:', currentConfig.cloud_name);

    // Delete the image from Cloudinary
    const result = await cloudinary.uploader.destroy(finalPublicId);
    logger.log('Cloudinary delete result:', result);

    if (result.result === 'ok') {
      res.json({ 
        success: true, 
        message: 'Image deleted successfully',
        public_id: finalPublicId,
        result
      });
    } else if (result.result === 'not found') {
      logger.warn('Image not found in Cloudinary:', finalPublicId);
      res.status(404).json({ 
        success: false, 
        message: 'Image not found in Cloudinary',
        public_id: finalPublicId,
        result
      });
    } else {
      logger.error('Failed to delete image:', result);
      res.status(400).json({ 
        success: false, 
        message: 'Failed to delete image',
        error: result,
        public_id: finalPublicId
      });
    }
  } catch (error) {
    logger.error('Error deleting image from Cloudinary:', {
      error: error.message,
      stack: error.stack,
      config: {
        cloud_name: cloudinary.config().cloud_name,
        hasApiKey: !!cloudinary.config().api_key,
        hasApiSecret: !!cloudinary.config().api_secret
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting image',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router; 