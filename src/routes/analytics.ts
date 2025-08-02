import express from 'express';
import { getAnalyticsOverview, getUserAnalytics, initializeAnalytics } from '../controllers/analytics.js';

const router = express.Router();

// Get analytics overview (public endpoint)
router.get('/overview', getAnalyticsOverview);

// Get user analytics (requires authentication)
router.get('/user/:userId', getUserAnalytics);

// Initialize analytics (admin endpoint)
router.post('/initialize', initializeAnalytics);

export default router; 