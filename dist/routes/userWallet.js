import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { PaymentLink } from '../models/PaymentLink.js';
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
export default router;
//# sourceMappingURL=userWallet.js.map