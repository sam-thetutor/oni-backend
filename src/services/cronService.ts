import cron from 'node-cron';
import { GamificationService } from './gamification.js';

export class CronService {
  private static instance: CronService;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {}

  static getInstance(): CronService {
    if (!CronService.instance) {
      CronService.instance = new CronService();
    }
    return CronService.instance;
  }

  /**
   * Initialize all cron jobs
   */
  init(): void {
    console.log('🕐 Initializing cron jobs...');
    
    // Weekly leaderboard reset - every Sunday at 00:00 UTC
    this.scheduleWeeklyReset();
    
    console.log('✅ Cron jobs initialized');
  }

  /**
   * Schedule weekly leaderboard reset
   */
  private scheduleWeeklyReset(): void {
    const job = cron.schedule('0 0 * * 0', async () => {
      console.log('🔄 Weekly reset cron job triggered');
      try {
        await GamificationService.resetWeeklyStats();
        console.log('✅ Weekly reset completed successfully');
      } catch (error) {
        console.error('❌ Weekly reset failed:', error);
      }
    }, {
      timezone: 'UTC',
      scheduled: true
    });

    this.jobs.set('weeklyReset', job);
    console.log('📅 Weekly reset scheduled for every Sunday at 00:00 UTC');
  }

  /**
   * Stop all cron jobs
   */
  stop(): void {
    console.log('🛑 Stopping all cron jobs...');
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️  Stopped job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Get status of all jobs
   */
  getStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    this.jobs.forEach((job, name) => {
      status[name] = job.getStatus() === 'scheduled';
    });
    return status;
  }

  /**
   * Manually trigger weekly reset (for testing)
   */
  async triggerWeeklyReset(): Promise<void> {
    console.log('🔧 Manually triggering weekly reset...');
    try {
      await GamificationService.resetWeeklyStats();
      console.log('✅ Manual weekly reset completed successfully');
    } catch (error) {
      console.error('❌ Manual weekly reset failed:', error);
      throw error;
    }
  }
} 