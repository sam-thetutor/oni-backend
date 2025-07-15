import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { GamificationService } from '../services/gamification.js';
const router = Router();
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const privyId = req.user?.id;
        if (!privyId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const stats = await GamificationService.getUserStats(privyId);
        if (!stats) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            stats
        });
    }
    catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({
            error: 'Failed to get user stats',
            message: error.message
        });
    }
});
router.get('/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const leaderboard = await GamificationService.getLeaderboard(limit);
        console.log('Leaderboard:', leaderboard);
        res.json({
            success: true,
            leaderboard
        });
    }
    catch (error) {
        console.error('Error getting leaderboard:', error);
        res.status(500).json({
            error: 'Failed to get leaderboard',
            message: error.message
        });
    }
});
router.get('/position', authenticateToken, async (req, res) => {
    try {
        const privyId = req.user?.id;
        if (!privyId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const position = await GamificationService.getUserLeaderboardPosition(privyId);
        if (!position) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            position
        });
    }
    catch (error) {
        console.error('Error getting user position:', error);
        res.status(500).json({
            error: 'Failed to get user position',
            message: error.message
        });
    }
});
router.get('/milestones', async (req, res) => {
    try {
        const milestones = GamificationService.getAchievementMilestones();
        res.json({
            success: true,
            milestones
        });
    }
    catch (error) {
        console.error('Error getting milestones:', error);
        res.status(500).json({
            error: 'Failed to get milestones',
            message: error.message
        });
    }
});
router.get('/achievements', authenticateToken, async (req, res) => {
    try {
        const privyId = req.user?.id;
        if (!privyId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const stats = await GamificationService.getUserStats(privyId);
        if (!stats) {
            return res.status(404).json({ error: 'User not found' });
        }
        const milestones = GamificationService.getAchievementMilestones();
        const userAchievements = milestones.map(milestone => ({
            ...milestone,
            achieved: stats.totalVolume >= milestone.volumeRequired,
            progress: Math.min((stats.totalVolume / milestone.volumeRequired) * 100, 100)
        }));
        res.json({
            success: true,
            achievements: userAchievements,
            totalAchievements: milestones.length,
            achievedCount: userAchievements.filter(a => a.achieved).length
        });
    }
    catch (error) {
        console.error('Error getting user achievements:', error);
        res.status(500).json({
            error: 'Failed to get user achievements',
            message: error.message
        });
    }
});

// Get weekly leaderboard
router.get('/weekly-leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const result = await GamificationService.getWeeklyLeaderboard(limit);
        console.log('Weekly Leaderboard:', result);

        res.json({
            success: true,
            leaderboard: result.leaderboard,
            stats: result.stats
        });
    } catch (error) {
        console.error('Error getting weekly leaderboard:', error);
        res.status(500).json({ 
            error: 'Failed to get weekly leaderboard',
            message: error.message 
        });
    }
});

router.post('/username', authenticateToken, async (req, res) => {
    try {
        const privyId = req.user?.id;
        const { username } = req.body;
        if (!privyId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!req.user || !req.user.dbUser) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!username || typeof username !== 'string' || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: 'Invalid username. Must be 3-20 characters, alphanumeric or underscores.' });
        }
        const existing = await req.user.dbUser.constructor.findOne({ username: username });
        if (existing && existing.privyId !== privyId) {
            return res.status(409).json({ error: 'Username already taken' });
        }
        req.user.dbUser.username = username;
        await req.user.dbUser.save();
        res.json({ success: true, username });
    }
    catch (error) {
        console.error('Error setting username:', error);
        res.status(500).json({ error: 'Failed to set username', message: error.message });
    }
});
export default router;
//# sourceMappingURL=gamification.js.map