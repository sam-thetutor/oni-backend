import { Router } from 'express';
import { ContractController } from '../controllers/contract.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
const contractController = new ContractController();
router.post('/create-global-payment-link', authenticateToken, contractController.createGlobalPaymentLink.bind(contractController));
router.post('/create-fixed-payment-link', authenticateToken, contractController.createFixedPaymentLink.bind(contractController));
router.post('/create-invoice', authenticateToken, contractController.createInvoice.bind(contractController));
router.post('/pay-global-payment-link', authenticateToken, contractController.payGlobalPaymentLink.bind(contractController));
router.post('/pay-fixed-payment-link', authenticateToken, contractController.payFixedPaymentLink.bind(contractController));
router.post('/pay-invoice', authenticateToken, contractController.payInvoice.bind(contractController));
router.get('/payment-link-status/:linkId', contractController.checkPaymentLinkStatus.bind(contractController));
router.get('/global-payment-link-status/:linkId', contractController.checkGlobalPaymentLinkStatus.bind(contractController));
export { router as contractRoutes };
//# sourceMappingURL=contract.js.map