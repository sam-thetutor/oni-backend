import { User } from '../models/User.js';
export class GamificationService {
    static POINTS_CONFIG = {
        TRANSACTION_SUCCESS: 50,
        FIRST_TRANSACTION: 200,
        VOLUME_MULTIPLIER: 10,
        LARGE_VOLUME_BONUS: 100,
        HIGH_VOLUME_BONUS: 250,
        VOLUME_MILESTONE_BONUS: 500,
    };
    static calculateTransactionReward(user, amount, isFirstTransaction = false) {
        let basePoints = this.POINTS_CONFIG.TRANSACTION_SUCCESS;
        let bonusPoints = 0;
        const reasons = [];
        const amountNum = parseFloat(amount);
        const volumePoints = Math.floor(amountNum * this.POINTS_CONFIG.VOLUME_MULTIPLIER);
        basePoints += volumePoints;
        reasons.push(`${volumePoints} points for ${amountNum} XFI volume`);
        if (isFirstTransaction) {
            bonusPoints += this.POINTS_CONFIG.FIRST_TRANSACTION;
            reasons.push('First transaction bonus');
        }
        if (amountNum >= 5.0) {
            bonusPoints += this.POINTS_CONFIG.LARGE_VOLUME_BONUS;
            reasons.push('Large volume bonus (5+ XFI)');
        }
        if (amountNum >= 10.0) {
            bonusPoints += this.POINTS_CONFIG.HIGH_VOLUME_BONUS;
            reasons.push('High volume bonus (10+ XFI)');
        }
        const newTotalVolume = user.totalVolume + amountNum;
        const volumeMilestones = [10, 50, 100, 500, 1000];
        for (const milestone of volumeMilestones) {
            if (user.totalVolume < milestone && newTotalVolume >= milestone) {
                bonusPoints += this.POINTS_CONFIG.VOLUME_MILESTONE_BONUS;
                reasons.push(`${milestone} XFI volume milestone bonus`);
                break;
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
    static async awardTransactionPoints(user, amount) {
        try {
            const isFirstTransaction = user.totalVolume === 0;
            const reward = this.calculateTransactionReward(user, amount, isFirstTransaction);
            await user.addPoints(reward.totalPoints);
            await user.addVolume(parseFloat(amount));
            await user.addWeeklyPoints(reward.totalPoints);
            await user.addWeeklyVolume(parseFloat(amount));
            return reward;
        }
        catch (error) {
            console.error('Error awarding transaction points:', error);
            throw new Error('Failed to award points');
        }
    }
    static async getUserStats(privyId) {
        try {
            const user = await User.findOne({ privyId });
            if (!user) {
                return null;
            }
            const rank = await User.countDocuments({ points: { $gt: user.points } }) + 1;
            const pointsMilestones = [100, 500, 1000, 2500, 5000, 10000];
            const nextMilestone = pointsMilestones.find(m => m > user.points) || user.points;
            const volumeMilestones = [10, 50, 100, 500, 1000];
            const nextVolumeMilestone = volumeMilestones.find(m => m > user.totalVolume) || user.totalVolume;
            return {
                points: user.points,
                totalVolume: user.totalVolume,
                rank,
                nextMilestone,
                nextVolumeMilestone
            };
        }
        catch (error) {
            console.error('Error getting user stats:', error);
            throw new Error('Failed to get user stats');
        }
    }
    static async getLeaderboard(limit = 10) {
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
        }
        catch (error) {
            console.error('Error getting leaderboard:', error);
            throw new Error('Failed to get leaderboard');
        }
    }
    static async getUserLeaderboardPosition(privyId) {
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
        }
        catch (error) {
            console.error('Error getting user leaderboard position:', error);
            throw new Error('Failed to get user position');
        }
    }
    static async getWeeklyLeaderboard(limit = 100) {
        try {
            const now = new Date();
            const weekStart = new Date(now);
            const dayOfWeek = now.getDay();
            const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            weekStart.setDate(now.getDate() - daysToSubtract);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            const weekNumber = this.getWeekNumber(now);
            const year = now.getFullYear();
            const users = await User.find({})
                .sort({ points: -1, totalVolume: -1, createdAt: 1 })
                .limit(limit)
                .select('privyId walletAddress points totalVolume createdAt username weeklyPoints weeklyVolume');
            const leaderboard = [];
            let totalWeeklyVolume = 0;
            for (const user of users) {
                if (user.weeklyPoints === undefined || user.weeklyVolume === undefined) {
                    user.weeklyPoints = Math.floor(user.points * 0.1);
                    user.weeklyVolume = Math.floor(user.totalVolume * 0.1);
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
            leaderboard.sort((a, b) => b.weeklyPoints - a.weeklyPoints);
            leaderboard.forEach((entry, index) => {
                entry.rank = index + 1;
            });
            const nextReset = new Date(now);
            const daysUntilSunday = (7 - now.getUTCDay()) % 7;
            nextReset.setUTCDate(now.getUTCDate() + daysUntilSunday);
            nextReset.setUTCHours(0, 0, 0, 0);
            const stats = {
                totalParticipants: leaderboard.length,
                totalWeeklyVolume,
                resetTime: nextReset.toISOString(),
                weekNumber,
                year
            };
            return { leaderboard, stats };
        }
        catch (error) {
            console.error('Error getting weekly leaderboard:', error);
            throw new Error('Failed to get weekly leaderboard');
        }
    }
    static getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }
    static async resetWeeklyStats() {
        try {
            console.log('🔄 Resetting weekly stats...');
            await User.updateMany({}, {
                $set: {
                    weeklyPoints: 0,
                    weeklyVolume: 0
                }
            });
            console.log('✅ Weekly stats reset completed');
        }
        catch (error) {
            console.error('❌ Error resetting weekly stats:', error);
            throw new Error('Failed to reset weekly stats');
        }
    }
    static getAchievementMilestones() {
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
    static async checkAndAwardMilestones(user) {
        try {
            const milestones = this.getAchievementMilestones();
            const awardedMilestones = [];
            for (const milestone of milestones) {
                if (user.totalVolume >= milestone.volumeRequired) {
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
        }
        catch (error) {
            console.error('Error checking milestones:', error);
            return [];
        }
    }
}
//# sourceMappingURL=gamification.js.map