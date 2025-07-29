import { Router } from 'express';
import { UserPaymentLinksController } from '../controllers/userPaymentLinks.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
const userPaymentLinksController = new UserPaymentLinksController();
router.get('/public/:linkId', userPaymentLinksController.getPublicPaymentLink);
router.use(authenticateToken);
router.get('/', userPaymentLinksController.getUserPaymentLinks);
router.get('/stats', userPaymentLinksController.getUserPaymentLinkStats);
router.get('/:linkId', userPaymentLinksController.getUserPaymentLink);
router.delete('/:linkId', userPaymentLinksController.deleteUserPaymentLink);
export default router;
//# sourceMappingURL=userPaymentLinks.js.map