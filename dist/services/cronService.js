import * as cron from 'node-cron';
import { GamificationService } from './gamification.js';
export class CronService {
    static instance;
    jobs = new Map();
    constructor() { }
    static getInstance() {
        if (!CronService.instance) {
            CronService.instance = new CronService();
        }
        return CronService.instance;
    }
    init() {
        console.log('🕐 Initializing cron jobs...');
        this.scheduleWeeklyReset();
        console.log('✅ Cron jobs initialized');
    }
    scheduleWeeklyReset() {
        const job = cron.schedule('0 0 * * 0', async () => {
            console.log('🔄 Weekly reset cron job triggered');
            try {
                await GamificationService.resetWeeklyStats();
                console.log('✅ Weekly reset completed successfully');
            }
            catch (error) {
                console.error('❌ Weekly reset failed:', error);
            }
        }, {
            timezone: 'UTC'
        });
        this.jobs.set('weeklyReset', job);
        console.log('📅 Weekly reset scheduled for every Sunday at 00:00 UTC');
    }
    stop() {
        console.log('🛑 Stopping all cron jobs...');
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`⏹️  Stopped job: ${name}`);
        });
        this.jobs.clear();
    }
    getStatus() {
        const status = {};
        this.jobs.forEach((job, name) => {
            status[name] = job.getStatus() === 'scheduled';
        });
        return status;
    }
    async triggerWeeklyReset() {
        console.log('🔧 Manually triggering weekly reset...');
        try {
            await GamificationService.resetWeeklyStats();
            console.log('✅ Manual weekly reset completed successfully');
        }
        catch (error) {
            console.error('❌ Manual weekly reset failed:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=cronService.js.map