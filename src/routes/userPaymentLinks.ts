import { Router } from 'express';
import { UserPaymentLinksController } from '../controllers/userPaymentLinks.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const userPaymentLinksController = new UserPaymentLinksController();

// Public routes (no authentication required)
/**
 * GET /api/user/payment-links/public/:linkId
 * Get specific payment link details (public access)
 */
router.get('/public/:linkId', userPaymentLinksController.getPublicPaymentLink);

// Protected routes (authentication required)
router.use(authenticateToken);

/**
 * GET /api/user/payment-links
 * Get all payment links for the authenticated user
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 10)
 * - type: 'fixed' | 'global' | 'all' (default: 'all')
 */
router.get('/', userPaymentLinksController.getUserPaymentLinks);

/**
 * GET /api/user/payment-links/stats
 * Get payment link statistics for the authenticated user
 */
router.get('/stats', userPaymentLinksController.getUserPaymentLinkStats);

/**
 * GET /api/user/payment-links/:linkId
 * Get specific payment link details for the authenticated user
 */
router.get('/:linkId', userPaymentLinksController.getUserPaymentLink);

/**
 * DELETE /api/user/payment-links/:linkId
 * Delete (cancel) a payment link for the authenticated user
 */
router.delete('/:linkId', userPaymentLinksController.deleteUserPaymentLink);

export default router; 