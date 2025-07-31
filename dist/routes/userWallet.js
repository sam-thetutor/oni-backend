import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { PaymentLink } from '../models/PaymentLink.js';
import { WalletFundingService } from '../services/wallet-funding.js';
const router = express.Router();
router.get('/', authenticateToken, async (req, res) => {
    try {
        const dbUser = req.user?.dbUser;
        if (!dbUser || !dbUser.walletAddress) {
            return res.status(404).json({ error: 'No Oni wallet found for user' });
        }
        res.json({ walletAddress: dbUser.walletAddress });
    }
    catch (error) {
        console.error('Error in userWallet route:', error);
        res.status(500).json({ error: 'Failed to fetch Oni wallet' });
    }
});
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
    }
    catch (error) {
        console.error('Error fetching payment link:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
router.get('/funding-status', authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        console.error('Error checking funding status:', error);
        res.status(500).json({ error: 'Failed to check funding status' });
    }
});
router.get('/funding-wallet', async (req, res) => {
    try {
        const fundingAddress = WalletFundingService.getFundingWalletAddress();
        const fundingBalance = await WalletFundingService.getFundingWalletBalance();
        res.json({
            fundingAddress,
            fundingBalance,
            fundingAmount: '0.01'
        });
    }
    catch (error) {
        console.error('Error getting funding wallet info:', error);
        res.status(500).json({ error: 'Failed to get funding wallet info' });
    }
});
export default router;
//# sourceMappingURL=userWallet.js.map