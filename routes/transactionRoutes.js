import express from 'express';
import { Transaction } from '../models/Transaction.js';

const router = express.Router();

// Simple logger utility
const isProduction = process.env.NODE_ENV === 'production';
const logger = {
  log: (...args) => { if (!isProduction) console.log(...args); },
  error: (...args) => { if (!isProduction) console.error(...args); },
  warn: (...args) => { if (!isProduction) console.warn(...args); }
};

/**
 * @route   POST /api/transactions
 * @desc    Create a new transaction
 */
router.post('/', async (req, res) => {
  try {
    const {
      piAmount,
      usdValue,
      inrValue,
      upiId,
      imageUrl,
      userInfo,
      SellRateUsd,
      SellRateInr
    } = req.body;

    const transaction = new Transaction({
      piAmount,
      usdValue,
      inrValue,
      upiId,
      imageUrl,
      userInfo,
      SellRateUsd,
      SellRateInr
    });

    const savedTransaction = await transaction.save();

    res.status(201).json({ success: true, data: savedTransaction });
  } catch (error) {
    logger.error('Error saving transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Error saving transaction',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions
 */
router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/transactions/:userId
 * @desc    Get transactions for a specific user by ID
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await Transaction.find({ 'userInfo.id': userId }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   GET /api/transactions/search/:query
 * @desc    Search transactions by email, username, or phone
 */
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const transactions = await Transaction.find({
      $or: [
        { 'userInfo.email': { $regex: query, $options: 'i' } },
        { 'userInfo.username': { $regex: query, $options: 'i' } },
        { 'userInfo.phone': { $regex: query, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    logger.error('Error searching transactions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/transactions/:id/status
 * @desc    Update transaction status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected', 'completed', 'processing'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Valid options: ${validStatuses.join(', ')}` });
    }

    const transaction = await Transaction.findByIdAndUpdate(id, { status }, { new: true });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    logger.error('Error updating transaction:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Delete a transaction
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findByIdAndDelete(id);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully', transaction });
  } catch (error) {
    logger.error('Error deleting transaction:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
