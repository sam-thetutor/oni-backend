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

export interface ActivityReward {
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  reason: string;
}

export class GamificationService {
  // Points configuration
  private static readonly POINTS_CONFIG = {
    // Transaction rewards
    TRANSACTION_SUCCESS: 50,       // Base points for successful transaction
    FIRST_TRANSACTION: 200,        // Bonus for first transaction
    VOLUME_MULTIPLIER: 10,         // Points per XFI in transaction
    LARGE_VOLUME_BONUS: 100,       // Bonus for transactions > 5 XFI
    HIGH_VOLUME_BONUS: 250,        // Bonus for transactions > 10 XFI
    VOLUME_MILESTONE_BONUS: 500,   // Bonus for reaching volume milestones
    
    // Swap rewards
    SWAP_SUCCESS: 30,              // Base points for successful swap
    FIRST_SWAP: 150,               // Bonus for first swap
    SWAP_VOLUME_MULTIPLIER: 8,     // Points per XFI in swap
    SWAP_LARGE_VOLUME_BONUS: 80,   // Bonus for swaps > 5 XFI
    SWAP_HIGH_VOLUME_BONUS: 200,   // Bonus for swaps > 10 XFI
    
    // Payment link rewards
    PAYMENT_LINK_CREATED: 25,      // Base points for creating payment link
    FIRST_PAYMENT_LINK: 100,       // Bonus for first payment link
    GLOBAL_PAYMENT_LINK_BONUS: 50, // Bonus for global payment links
    FIXED_PAYMENT_LINK_BONUS: 30,  // Bonus for fixed payment links
    
    // DCA order rewards
    DCA_ORDER_CREATED: 40,         // Base points for creating DCA order
    FIRST_DCA_ORDER: 120,          // Bonus for first DCA order
    DCA_ORDER_VOLUME_MULTIPLIER: 6, // Points per XFI in DCA order
    DCA_ORDER_EXECUTED: 60,        // Bonus when DCA order executes
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
   * Calculate reward points for a swap based on volume
   */
  static calculateSwapReward(user: IUser, amount: string, isFirstSwap: boolean = false): ActivityReward {
    let basePoints = this.POINTS_CONFIG.SWAP_SUCCESS;
    let bonusPoints = 0;
    const reasons: string[] = [];

    const amountNum = parseFloat(amount);
    
    // Volume-based points (points per XFI)
    const volumePoints = Math.floor(amountNum * this.POINTS_CONFIG.SWAP_VOLUME_MULTIPLIER);
    basePoints += volumePoints;
    reasons.push(`${volumePoints} points for ${amountNum} XFI swap volume`);

    // First swap bonus
    if (isFirstSwap) {
      bonusPoints += this.POINTS_CONFIG.FIRST_SWAP;
      reasons.push('First swap bonus');
    }

    // Large volume bonus (swaps > 5 XFI)
    if (amountNum >= 5.0) {
      bonusPoints += this.POINTS_CONFIG.SWAP_LARGE_VOLUME_BONUS;
      reasons.push('Large swap volume bonus (5+ XFI)');
    }

    // High volume bonus (swaps > 10 XFI)
    if (amountNum >= 10.0) {
      bonusPoints += this.POINTS_CONFIG.SWAP_HIGH_VOLUME_BONUS;
      reasons.push('High swap volume bonus (10+ XFI)');
    }

    const totalPoints = basePoints + bonusPoints;

    return {
      basePoints,
      bonusPoints,
      totalPoints,
      reason: reasons.join(', ') || 'Standard swap reward'
    };
  }

  /**
   * Calculate reward points for payment link creation
   */
  static calculatePaymentLinkReward(user: IUser, isGlobal: boolean, isFirstPaymentLink: boolean = false): ActivityReward {
    let basePoints = this.POINTS_CONFIG.PAYMENT_LINK_CREATED;
    let bonusPoints = 0;
    const reasons: string[] = [];

    // First payment link bonus
    if (isFirstPaymentLink) {
      bonusPoints += this.POINTS_CONFIG.FIRST_PAYMENT_LINK;
      reasons.push('First payment link bonus');
    }

    // Type-specific bonus
    if (isGlobal) {
      bonusPoints += this.POINTS_CONFIG.GLOBAL_PAYMENT_LINK_BONUS;
      reasons.push('Global payment link bonus');
    } else {
      bonusPoints += this.POINTS_CONFIG.FIXED_PAYMENT_LINK_BONUS;
      reasons.push('Fixed payment link bonus');
    }

    const totalPoints = basePoints + bonusPoints;

    return {
      basePoints,
      bonusPoints,
      totalPoints,
      reason: reasons.join(', ') || 'Payment link creation reward'
    };
  }

  /**
   * Calculate reward points for DCA order creation
   */
  static calculateDCAOrderReward(user: IUser, amount: string, isFirstDCAOrder: boolean = false): ActivityReward {
    let basePoints = this.POINTS_CONFIG.DCA_ORDER_CREATED;
    let bonusPoints = 0;
    const reasons: string[] = [];

    const amountNum = parseFloat(amount);
    
    // Volume-based points (points per XFI)
    const volumePoints = Math.floor(amountNum * this.POINTS_CONFIG.DCA_ORDER_VOLUME_MULTIPLIER);
    basePoints += volumePoints;
    reasons.push(`${volumePoints} points for ${amountNum} XFI DCA order volume`);

    // First DCA order bonus
    if (isFirstDCAOrder) {
      bonusPoints += this.POINTS_CONFIG.FIRST_DCA_ORDER;
      reasons.push('First DCA order bonus');
    }

    const totalPoints = basePoints + bonusPoints;

    return {
      basePoints,
      bonusPoints,
      totalPoints,
      reason: reasons.join(', ') || 'DCA order creation reward'
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
   * Award points to user for successful swap
   */
  static async awardSwapPoints(user: IUser, amount: string): Promise<ActivityReward> {
    try {
      // Check if this is the first swap (you might want to track this separately)
      const isFirstSwap = user.totalVolume === 0; // Using totalVolume as a proxy for now
      const reward = this.calculateSwapReward(user, amount, isFirstSwap);
      
      // Add points to user
      await user.addPoints(reward.totalPoints);
      
      // Add weekly points
      await user.addWeeklyPoints(reward.totalPoints);
      
      return reward;
    } catch (error) {
      console.error('Error awarding swap points:', error);
      throw new Error('Failed to award swap points');
    }
  }

  /**
   * Award points to user for payment link creation
   */
  static async awardPaymentLinkPoints(user: IUser, isGlobal: boolean): Promise<ActivityReward> {
    try {
      // Check if this is the first payment link (you might want to track this separately)
      const isFirstPaymentLink = user.points < 100; // Simple heuristic for now
      const reward = this.calculatePaymentLinkReward(user, isGlobal, isFirstPaymentLink);
      
      // Add points to user
      await user.addPoints(reward.totalPoints);
      
      // Add weekly points
      await user.addWeeklyPoints(reward.totalPoints);
      
      return reward;
    } catch (error) {
      console.error('Error awarding payment link points:', error);
      throw new Error('Failed to award payment link points');
    }
  }

  /**
   * Award points to user for DCA order creation
   */
  static async awardDCAOrderPoints(user: IUser, amount: string): Promise<ActivityReward> {
    try {
      // Check if this is the first DCA order (you might want to track this separately)
      const isFirstDCAOrder = user.points < 200; // Simple heuristic for now
      const reward = this.calculateDCAOrderReward(user, amount, isFirstDCAOrder);
      
      // Add points to user
      await user.addPoints(reward.totalPoints);
      
      // Add weekly points
      await user.addWeeklyPoints(reward.totalPoints);
      
      return reward;
    } catch (error) {
      console.error('Error awarding DCA order points:', error);
      throw new Error('Failed to award DCA order points');
    }
  }

  /**
   * Award points to user for DCA order execution
   */
  static async awardDCAOrderExecutionPoints(user: IUser): Promise<ActivityReward> {
    try {
      const reward: ActivityReward = {
        basePoints: this.POINTS_CONFIG.DCA_ORDER_EXECUTED,
        bonusPoints: 0,
        totalPoints: this.POINTS_CONFIG.DCA_ORDER_EXECUTED,
        reason: 'DCA order executed successfully'
      };
      
      // Add points to user
      await user.addPoints(reward.totalPoints);
      
      // Add weekly points
      await user.addWeeklyPoints(reward.totalPoints);
      
      return reward;
    } catch (error) {
      console.error('Error awarding DCA execution points:', error);
      throw new Error('Failed to award DCA execution points');
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