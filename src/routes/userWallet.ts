import express, { Request } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { PaymentLink } from '../models/PaymentLink.js';
import { WalletFundingService } from '../services/wallet-funding.js';

interface AuthenticatedRequest extends Request {
  user?: {
    dbUser?: any;
  };
}

const router = express.Router();

// GET /api/userWallet - Get the Oni Wallet address for the authenticated user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const dbUser = req.user?.dbUser;
    if (!dbUser || !dbUser.walletAddress) {
      return res.status(404).json({ error: 'No Oni wallet found for user' });
    }

    res.json({ walletAddress: dbUser.walletAddress });
  } catch (error) {
    console.error('Error in userWallet route:', error);
    res.status(500).json({ error: 'Failed to fetch Oni wallet' });
  }
});

// Get payment link details
router.get('/paylink/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;
    
    const paymentLink = await PaymentLink.findOne({ linkId });
    
    if (!paymentLink) {
      return res.status(404).json({
        success: false,
        error: 'Payment link not found'
      });
    }

    res.json({
      success: true,
      data: {
        linkId: paymentLink.linkId,
        amount: paymentLink.amount,
        status: paymentLink.status,
        createdAt: paymentLink.createdAt,
        updatedAt: paymentLink.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching payment link:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/userWallet/funding-status - Check if user's wallet has been funded
router.get('/funding-status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const dbUser = req.user?.dbUser;
    if (!dbUser || !dbUser.walletAddress) {
      return res.status(404).json({ error: 'No Oni wallet found for user' });
    }

    const hasBeenFunded = await WalletFundingService.checkWalletFunding(dbUser.walletAddress);
    
    res.json({ 
      hasBeenFunded,
      walletAddress: dbUser.walletAddress 
    });
  } catch (error) {
    console.error('Error checking funding status:', error);
    res.status(500).json({ error: 'Failed to check funding status' });
  }
});

// GET /api/userWallet/funding-wallet - Get funding wallet information
router.get('/funding-wallet', async (req, res) => {
  try {
    const fundingAddress = WalletFundingService.getFundingWalletAddress();
    const fundingBalance = await WalletFundingService.getFundingWalletBalance();
    
    res.json({
      fundingAddress,
      fundingBalance,
      fundingAmount: '0.01' // Amount sent to new users
    });
  } catch (error) {
    console.error('Error getting funding wallet info:', error);
    res.status(500).json({ error: 'Failed to get funding wallet info' });
  }
});

export default router;
