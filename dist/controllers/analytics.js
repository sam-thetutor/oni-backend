import { AnalyticsService } from '../services/analytics.js';
export const getAnalyticsOverview = async (req, res) => {
    try {
        console.log('📊 Fetching analytics overview...');
        const analytics = await AnalyticsService.getAnalyticsOverview();
        if (!analytics) {
            return res.status(404).json({
                success: false,
                error: 'Analytics data not found'
            });
        }
        console.log('✅ Analytics overview fetched successfully');
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('❌ Error fetching analytics overview:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch analytics'
        });
    }
};
export const getUserAnalytics = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }
        console.log(`📊 Fetching analytics for user: ${userId}`);
        const userAnalytics = await AnalyticsService.getUserAnalytics(userId);
        if (!userAnalytics) {
            return res.status(404).json({
                success: false,
                error: 'User analytics not found'
            });
        }
        console.log('✅ User analytics fetched successfully');
        res.json({
            success: true,
            data: userAnalytics
        });
    }
    catch (error) {
        console.error('❌ Error fetching user analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch user analytics'
        });
    }
};
export const initializeAnalytics = async (req, res) => {
    try {
        console.log('🔧 Initializing analytics...');
        await AnalyticsService.initializeAnalytics();
        console.log('✅ Analytics initialized successfully');
        res.json({
            success: true,
            message: 'Analytics initialized successfully'
        });
    }
    catch (error) {
        console.error('❌ Error initializing analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to initialize analytics'
        });
    }
};
//# sourceMappingURL=analytics.js.map