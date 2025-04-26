import express from 'express';
import { Transaction } from '../models/Transaction.js';
import { clerkClient } from '@clerk/clerk-sdk-node';

const router = express.Router();

// Simple logger utility
const isProduction = process.env.NODE_ENV === 'production';
const logger = {
  log: (...args) => { if (!isProduction) console.log(...args); },
  error: (...args) => { if (!isProduction) console.error(...args); },
  warn: (...args) => { if (!isProduction) console.warn(...args); }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user from Clerk and all their transactions
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First delete the user from Clerk
    try {
      await clerkClient.users.deleteUser(id);
    } catch (clerkError) {
      logger.error('Error deleting user from Clerk:', clerkError);
      return res.status(500).json({ 
        message: 'Failed to delete user from authentication system',
        error: clerkError.message 
      });
    }

    // Then delete all transactions associated with the user
    await Transaction.deleteMany({ 'userInfo.id': id });

    res.json({ message: 'User and associated data deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 