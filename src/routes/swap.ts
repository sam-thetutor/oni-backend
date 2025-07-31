import { Router } from 'express';
import { SwapController } from '../controllers/swap.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Public routes (no authentication required)
router.post('/quote', SwapController.getSwapQuote);
router.get('/pairs', SwapController.getSupportedPairs);
router.get('/config', SwapController.getSwapConfig);

// Protected routes (require authentication)
router.post('/execute', authenticateToken, SwapController.executeSwap);
router.post('/validate', authenticateToken, SwapController.validateSwap);

export default router; 