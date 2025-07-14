import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { GamificationService } from '../services/gamification.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
    email?: string;
    dbUser?: any;
  };
}

const router = Router();

// Get user's stats and ranking
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error: any) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ 
      error: 'Failed to get user stats',
      message: error.message 
    });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await GamificationService.getLeaderboard(limit);
    console.log('Leaderboard:', leaderboard);

    res.json({
      success: true,
      leaderboard
    });
  } catch (error: any) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ 
      error: 'Failed to get leaderboard',
      message: error.message 
    });
  }
});

// Get user's leaderboard position
router.get('/position', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error: any) {
    console.error('Error getting user position:', error);
    res.status(500).json({ 
      error: 'Failed to get user position',
      message: error.message 
    });
  }
});

// Get achievement milestones
router.get('/milestones', async (req, res) => {
  try {
    const milestones = GamificationService.getAchievementMilestones();

    res.json({
      success: true,
      milestones
    });
  } catch (error: any) {
    console.error('Error getting milestones:', error);
    res.status(500).json({ 
      error: 'Failed to get milestones',
      message: error.message 
    });
  }
});

// Get user's achievements (authenticated)
router.get('/achievements', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error: any) {
    console.error('Error getting user achievements:', error);
    res.status(500).json({ 
      error: 'Failed to get user achievements',
      message: error.message 
    });
  }
});

// Set or update username
router.post('/username', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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
    // Check uniqueness
    const existing = await req.user.dbUser.constructor.findOne({ username: username });
    if (existing && existing.privyId !== privyId) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    // Update user
    req.user.dbUser.username = username;
    await req.user.dbUser.save();
    res.json({ success: true, username });
  } catch (error: any) {
    console.error('Error setting username:', error);
    res.status(500).json({ error: 'Failed to set username', message: error.message });
  }
});

export default router; 