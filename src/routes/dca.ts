import { Router } from 'express';
import { DCAController } from '../controllers/dca.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  rateLimitDCAOrders,
  checkMaxActiveOrders,
  validateOrderBalance,
  validateOrderOwnership,
  validateTriggerPrice,
  sanitizeNumericInputs
} from '../middleware/dca.js';

const router = Router();

// DCA Order Management Routes (require authentication)
router.post('/orders', 
  authenticateToken,
  sanitizeNumericInputs,
  validateTriggerPrice,
  rateLimitDCAOrders,
  checkMaxActiveOrders,
  validateOrderBalance,
  DCAController.createOrder
);
router.get('/orders', authenticateToken, DCAController.getUserOrders);
router.get('/orders/:orderId', authenticateToken, DCAController.getOrderById);
router.put('/orders/:orderId', 
  authenticateToken,
  sanitizeNumericInputs,
  validateTriggerPrice,
  validateOrderOwnership,
  DCAController.updateOrder
);
router.delete('/orders/:orderId', 
  authenticateToken,
  validateOrderOwnership,
  DCAController.cancelOrder
);

// User Statistics (require authentication)
router.get('/stats', authenticateToken, DCAController.getUserStats);

// Token Balances (require authentication)
router.get('/balances', authenticateToken, DCAController.getUserTokenBalances);



// System Status and Monitoring (public endpoints for monitoring)
router.get('/system/status', DCAController.getSystemStatus);

// Administrative System Control Endpoints
// Note: In production, these should have admin authentication
router.post('/system/start', DCAController.startExecutor);
router.post('/system/stop', DCAController.stopExecutor);
router.post('/system/execute', DCAController.forceExecuteOrders);
router.post('/system/simulate', DCAController.simulatePriceCheck);

// Configuration Management (admin endpoints)
router.get('/system/config', DCAController.getExecutorConfig);
router.put('/system/config', DCAController.updateExecutorConfig);

export default router; 