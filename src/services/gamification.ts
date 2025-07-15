import { User, IUser } from '../models/User.js';

export interface LeaderboardEntry {
  rank: number;
  privyId: string;
  walletAddress: string;
  points: number;
  totalVolume: number;
  createdAt: Date;
  username?: string;
}

export interface WeeklyLeaderboardEntry extends LeaderboardEntry {
  weeklyPoints: number;
  weeklyVolume: number;
}

export interface WeeklyStats {
  totalParticipants: number;
  totalWeeklyVolume: number;
  resetTime: string;
  weekNumber: number;
  year: number;
}

export interface TransactionReward {
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  reason: string;
}

export class GamificationService {
  // Points configuration
  private static readonly POINTS_CONFIG = {
    TRANSACTION_SUCCESS: 50,       // Base points for successful transaction
    FIRST_TRANSACTION: 200,        // Bonus for first transaction
    VOLUME_MULTIPLIER: 10,         // Points per XFI in transaction
    LARGE_VOLUME_BONUS: 100,       // Bonus for transactions > 5 XFI
    HIGH_VOLUME_BONUS: 250,        // Bonus for transactions > 10 XFI
    VOLUME_MILESTONE_BONUS: 500,   // Bonus for reaching volume milestones
  };

  /**
   * Calculate reward points for a transaction based on volume
   */
  static calculateTransactionReward(user: IUser, amount: string, isFirstTransaction: boolean = false): TransactionReward {
    let basePoints = this.POINTS_CONFIG.TRANSACTION_SUCCESS;
    let bonusPoints = 0;
    const reasons: string[] = [];

    const amountNum = parseFloat(amount);
    
    // Volume-based points (points per XFI)
    const volumePoints = Math.floor(amountNum * this.POINTS_CONFIG.VOLUME_MULTIPLIER);
    basePoints += volumePoints;
    reasons.push(`${volumePoints} points for ${amountNum} XFI volume`);

    // First transaction bonus
    if (isFirstTransaction) {
      bonusPoints += this.POINTS_CONFIG.FIRST_TRANSACTION;
      reasons.push('First transaction bonus');
    }

    // Large volume bonus (transactions > 5 XFI)
    if (amountNum >= 5.0) {
      bonusPoints += this.POINTS_CONFIG.LARGE_VOLUME_BONUS;
      reasons.push('Large volume bonus (5+ XFI)');
    }

    // High volume bonus (transactions > 10 XFI)
    if (amountNum >= 10.0) {
      bonusPoints += this.POINTS_CONFIG.HIGH_VOLUME_BONUS;
      reasons.push('High volume bonus (10+ XFI)');
    }

    // Volume milestone bonus (check if user reached new volume milestones)
    const newTotalVolume = user.totalVolume + amountNum;
    const volumeMilestones = [10, 50, 100, 500, 1000]; // XFI milestones
    
    for (const milestone of volumeMilestones) {
      if (user.totalVolume < milestone && newTotalVolume >= milestone) {
        bonusPoints += this.POINTS_CONFIG.VOLUME_MILESTONE_BONUS;
        reasons.push(`${milestone} XFI volume milestone bonus`);
        break; // Only award one milestone at a time
      }
    }

    const totalPoints = basePoints + bonusPoints;

    return {
      basePoints,
      bonusPoints,
      totalPoints,
      reason: reasons.join(', ') || 'Standard transaction reward'
    };
  }

  /**
   * Award points to user for successful transaction
   */
  static async awardTransactionPoints(user: IUser, amount: string): Promise<TransactionReward> {
    try {
      const isFirstTransaction = user.totalVolume === 0;
      const reward = this.calculateTransactionReward(user, amount, isFirstTransaction);
      
      // Add points to user
      await user.addPoints(reward.totalPoints);
      
      // Add volume to user
      await user.addVolume(parseFloat(amount));
      
      // Add weekly points and volume
      await user.addWeeklyPoints(reward.totalPoints);
      await user.addWeeklyVolume(parseFloat(amount));
      
      return reward;
    } catch (error) {
      console.error('Error awarding transaction points:', error);
      throw new Error('Failed to award points');
    }
  }

  /**
   * Get user's current stats
   */
  static async getUserStats(privyId: string): Promise<{
    points: number;
    totalVolume: number;
    rank: number;
    nextMilestone: number;
    nextVolumeMilestone: number;
  } | null> {
    try {
      const user = await User.findOne({ privyId });
      if (!user) {
        return null;
      }

      // Calculate rank
      const rank = await User.countDocuments({ points: { $gt: user.points } }) + 1;

      // Calculate next points milestone
      const pointsMilestones = [100, 500, 1000, 2500, 5000, 10000];
      const nextMilestone = pointsMilestones.find(m => m > user.points) || user.points;

      // Calculate next volume milestone
      const volumeMilestones = [10, 50, 100, 500, 1000];
      const nextVolumeMilestone = volumeMilestones.find(m => m > user.totalVolume) || user.totalVolume;

      return {
        points: user.points,
        totalVolume: user.totalVolume,
        rank,
        nextMilestone,
        nextVolumeMilestone
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw new Error('Failed to get user stats');
    }
  }

  /**
   * Get leaderboard
   */
  static async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    try {
      const users = await User.find({})
        .sort({ points: -1, totalVolume: -1, createdAt: 1 })
        .limit(limit)
        .select('privyId walletAddress points totalVolume createdAt username');

      return users.map((user, index) => ({
        rank: index + 1,
        privyId: user.privyId,
        walletAddress: user.walletAddress,
        points: user.points,
        totalVolume: user.totalVolume,
        createdAt: user.createdAt,
        username: user.username
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw new Error('Failed to get leaderboard');
    }
  }

  /**
   * Get user's position in leaderboard
   */
  static async getUserLeaderboardPosition(privyId: string): Promise<{
    rank: number;
    totalUsers: number;
    percentile: number;
  } | null> {
    try {
      const user = await User.findOne({ privyId });
      if (!user) {
        return null;
      }

      const totalUsers = await User.countDocuments({});
      const rank = await User.countDocuments({ points: { $gt: user.points } }) + 1;
      const percentile = totalUsers > 0 ? Math.round(((totalUsers - rank + 1) / totalUsers) * 100) : 100;

      return {
        rank,
        totalUsers,
        percentile
      };
    } catch (error) {
      console.error('Error getting user leaderboard position:', error);
      throw new Error('Failed to get user position');
    }
  }

  /**
   * Get weekly leaderboard
   */
  static async getWeeklyLeaderboard(limit: number = 100): Promise<{
    leaderboard: WeeklyLeaderboardEntry[];
    stats: WeeklyStats;
  }> {
    try {
      // Calculate current week boundaries (Monday to Sunday)
      const now = new Date();
      const weekStart = new Date(now);
      const dayOfWeek = now.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 1, Sunday = 0
      weekStart.setDate(now.getDate() - daysToSubtract);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Get week number and year
      const weekNumber = this.getWeekNumber(now);
      const year = now.getFullYear();

      // Get users with their weekly stats
      const users = await User.find({})
        .sort({ points: -1, totalVolume: -1, createdAt: 1 })
        .limit(limit)
        .select('privyId walletAddress points totalVolume createdAt username weeklyPoints weeklyVolume');

      // Calculate weekly stats for users who don't have them
      const leaderboard: WeeklyLeaderboardEntry[] = [];
      let totalWeeklyVolume = 0;

      for (const user of users) {
        // If user doesn't have weekly stats, calculate them
        if (user.weeklyPoints === undefined || user.weeklyVolume === undefined) {
          // For now, we'll use a simple calculation based on total stats
          // In a real implementation, you'd track weekly transactions separately
          user.weeklyPoints = Math.floor(user.points * 0.1); // 10% of total points as weekly
          user.weeklyVolume = Math.floor(user.totalVolume * 0.1); // 10% of total volume as weekly
          await user.save();
        }

        totalWeeklyVolume += user.weeklyVolume || 0;

        leaderboard.push({
          rank: leaderboard.length + 1,
          privyId: user.privyId,
          walletAddress: user.walletAddress,
          points: user.points,
          totalVolume: user.totalVolume,
          createdAt: user.createdAt,
          username: user.username,
          weeklyPoints: user.weeklyPoints || 0,
          weeklyVolume: user.weeklyVolume || 0
        });
      }

      // Sort by weekly points
      leaderboard.sort((a, b) => b.weeklyPoints - a.weeklyPoints);
      leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      // Calculate next reset time (next Sunday at 00:00 UTC)
      const nextReset = new Date(now);
      const daysUntilSunday = (7 - now.getUTCDay()) % 7;
      nextReset.setUTCDate(now.getUTCDate() + daysUntilSunday);
      nextReset.setUTCHours(0, 0, 0, 0);

      const stats: WeeklyStats = {
        totalParticipants: leaderboard.length,
        totalWeeklyVolume,
        resetTime: nextReset.toISOString(),
        weekNumber,
        year
      };

      return { leaderboard, stats };
    } catch (error) {
      console.error('Error getting weekly leaderboard:', error);
      throw new Error('Failed to get weekly leaderboard');
    }
  }

  /**
   * Get week number of the year
   */
  private static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Reset weekly stats (called by cron job)
   */
  static async resetWeeklyStats(): Promise<void> {
    try {
      console.log('🔄 Resetting weekly stats...');
      
      // Reset weekly points and volume for all users
      await User.updateMany({}, {
        $set: {
          weeklyPoints: 0,
          weeklyVolume: 0
        }
      });

      console.log('✅ Weekly stats reset completed');
    } catch (error) {
      console.error('❌ Error resetting weekly stats:', error);
      throw new Error('Failed to reset weekly stats');
    }
  }

  /**
   * Get achievement milestones
   */
  static getAchievementMilestones(): Array<{
    name: string;
    description: string;
    volumeRequired: number;
    reward: number;
  }> {
    return [
      {
        name: 'First Steps',
        description: 'Complete your first transaction',
        volumeRequired: 1,
        reward: 50
      },
      {
        name: 'Small Trader',
        description: 'Trade 10 XFI total volume',
        volumeRequired: 10,
        reward: 100
      },
      {
        name: 'Active Trader',
        description: 'Trade 50 XFI total volume',
        volumeRequired: 50,
        reward: 200
      },
      {
        name: 'Power Trader',
        description: 'Trade 100 XFI total volume',
        volumeRequired: 100,
        reward: 500
      },
      {
        name: 'Volume Master',
        description: 'Trade 500 XFI total volume',
        volumeRequired: 500,
        reward: 1000
      },
      {
        name: 'Whale Trader',
        description: 'Trade 1000 XFI total volume',
        volumeRequired: 1000,
        reward: 2500
      }
    ];
  }

  /**
   * Check and award achievement milestones
   */
  static async checkAndAwardMilestones(user: IUser): Promise<Array<{
    name: string;
    description: string;
    reward: number;
  }>> {
    try {
      const milestones = this.getAchievementMilestones();
      const awardedMilestones: Array<{ name: string; description: string; reward: number }> = [];

      for (const milestone of milestones) {
        if (user.totalVolume >= milestone.volumeRequired) {
          // Check if user has already received this milestone (simple check)
          // In a real implementation, you'd track awarded milestones separately
          const hasAchievement = user.points >= milestone.volumeRequired + milestone.reward;
          
          if (!hasAchievement) {
            await user.addPoints(milestone.reward);
            awardedMilestones.push({
              name: milestone.name,
              description: milestone.description,
              reward: milestone.reward
            });
          }
        }
      }

      return awardedMilestones;
    } catch (error) {
      console.error('Error checking milestones:', error);
      return [];
    }
  }
} 