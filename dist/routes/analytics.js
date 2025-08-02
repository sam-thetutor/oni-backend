import express from 'express';
import { getAnalyticsOverview, getUserAnalytics, initializeAnalytics } from '../controllers/analytics.js';
const router = express.Router();
router.get('/overview', getAnalyticsOverview);
router.get('/user/:userId', getUserAnalytics);
router.post('/initialize', initializeAnalytics);
export default router;
//# sourceMappingURL=analytics.js.map