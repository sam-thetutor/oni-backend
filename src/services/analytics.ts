import mongoose from 'mongoose';
import { AnalyticsOverview, UserAnalytics, TransactionRecord, MessageRecord } from '../types/analytics.js';

// MongoDB Models
const AnalyticsOverviewModel = mongoose.model('AnalyticsOverview', new mongoose.Schema({
  totalVolumeProcessed: {
    xfi: { type: String, default: '0' },
    usdc: { type: String, default: '0' }
  },
  totalTransactions: { type: Number, default: 0 },
  totalPaymentLinks: {
    count: { type: Number, default: 0 },
    totalAmount: {
      xfi: { type: String, default: '0' },
      usdc: { type: String, default: '0' }
    }
  },
  totalDCAOrders: {
    count: { type: Number, default: 0 },
    totalVolume: {
      xfi: { type: String, default: '0' },
      usdc: { type: String, default: '0' }
    }
  },
  totalMessages: { type: Number, default: 0 },
  totalUsers: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
}));

const UserAnalyticsModel = mongoose.model('UserAnalytics', new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  walletAddress: { type: String, required: true },
  messageCount: { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 },
  totalVolume: {
    xfi: { type: String, default: '0' },
    usdc: { type: String, default: '0' }
  },
  lastActivity: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}));

const TransactionRecordModel = mongoose.model('TransactionRecord', new mongoose.Schema({
  userId: { type: String, required: true },
  walletAddress: { type: String, required: true },
  transactionHash: { type: String },
  amount: { type: String, required: true },
  token: { type: String, enum: ['XFI', 'USDC'], required: true },
  type: { type: String, enum: ['send', 'receive', 'swap', 'dca'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  timestamp: { type: Date, default: Date.now }
}));

const MessageRecordModel = mongoose.model('MessageRecord', new mongoose.Schema({
  userId: { type: String, required: true },
  walletAddress: { type: String, required: true },
  messageType: { 
    type: String, 
    enum: ['balance_check', 'transaction', 'payment_link', 'dca', 'general', 'other'], 
    required: true 
  },
  timestamp: { type: Date, default: Date.now }
}));

export class AnalyticsService {
  // Initialize analytics overview if it doesn't exist
  static async initializeAnalytics() {
    const existing = await AnalyticsOverviewModel.findOne();
    if (!existing) {
      await AnalyticsOverviewModel.create({});
    }
  }

  // Helper function to add two string numbers
  private static addStrings(a: string, b: string): string {
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return (numA + numB).toString();
  }

  // Record a new transaction
  static async recordTransaction(
    userId: string, 
    walletAddress: string, 
    amount: string, 
    token: 'XFI' | 'USDC',
    type: 'send' | 'receive' | 'swap' | 'dca',
    transactionHash?: string,
    status: 'pending' | 'completed' | 'failed' = 'completed'
  ) {
    try {
      // Record the transaction
      await TransactionRecordModel.create({
        userId,
        walletAddress,
        transactionHash,
        amount,
        token,
        type,
        status,
        timestamp: new Date()
      });

      // Update user analytics
      let userAnalytics = await UserAnalyticsModel.findOne({ userId });
      if (!userAnalytics) {
        userAnalytics = await UserAnalyticsModel.create({
          userId,
          walletAddress,
          messageCount: 0,
          transactionCount: 0,
          totalVolume: { xfi: '0', usdc: '0' },
          lastActivity: new Date(),
          createdAt: new Date()
        });
      }

      // Update user transaction count and volume
      userAnalytics.transactionCount += 1;
      userAnalytics.totalVolume[token.toLowerCase() as 'xfi' | 'usdc'] = 
        this.addStrings(userAnalytics.totalVolume[token.toLowerCase() as 'xfi' | 'usdc'], amount);
      userAnalytics.lastActivity = new Date();
      await userAnalytics.save();

      // Update global analytics
      const overview = await AnalyticsOverviewModel.findOne();
      if (overview) {
        overview.totalTransactions += 1;
        overview.totalVolumeProcessed[token.toLowerCase() as 'xfi' | 'usdc'] = 
          this.addStrings(overview.totalVolumeProcessed[token.toLowerCase() as 'xfi' | 'usdc'], amount);
        overview.lastUpdated = new Date();
        await overview.save();
      }

      console.log(`📊 Analytics: Recorded ${amount} ${token} transaction for user ${userId}`);
    } catch (error) {
      console.error('Error recording transaction analytics:', error);
    }
  }

  // Record a new message
  static async recordMessage(
    userId: string, 
    walletAddress: string, 
    messageType: 'balance_check' | 'transaction' | 'payment_link' | 'dca' | 'general' | 'other'
  ) {
    try {
      // Record the message
      await MessageRecordModel.create({
        userId,
        walletAddress,
        messageType,
        timestamp: new Date()
      });

      // Update user analytics
      let userAnalytics = await UserAnalyticsModel.findOne({ userId });
      if (!userAnalytics) {
        userAnalytics = await UserAnalyticsModel.create({
          userId,
          walletAddress,
          messageCount: 0,
          transactionCount: 0,
          totalVolume: { xfi: '0', usdc: '0' },
          lastActivity: new Date(),
          createdAt: new Date()
        });
      }

      userAnalytics.messageCount += 1;
      userAnalytics.lastActivity = new Date();
      await userAnalytics.save();

      // Update global analytics
      const overview = await AnalyticsOverviewModel.findOne();
      if (overview) {
        overview.totalMessages += 1;
        overview.lastUpdated = new Date();
        await overview.save();
      }

      console.log(`📊 Analytics: Recorded ${messageType} message for user ${userId}`);
    } catch (error) {
      console.error('Error recording message analytics:', error);
    }
  }

  // Record payment link creation
  static async recordPaymentLink(
    userId: string, 
    walletAddress: string, 
    amount: string, 
    token: 'XFI' | 'USDC'
  ) {
    try {
      // Update global analytics
      const overview = await AnalyticsOverviewModel.findOne();
      if (overview) {
        overview.totalPaymentLinks.count += 1;
        overview.totalPaymentLinks.totalAmount[token.toLowerCase() as 'xfi' | 'usdc'] = 
          this.addStrings(overview.totalPaymentLinks.totalAmount[token.toLowerCase() as 'xfi' | 'usdc'], amount);
        overview.lastUpdated = new Date();
        await overview.save();
      }

      console.log(`📊 Analytics: Recorded payment link creation for user ${userId}`);
    } catch (error) {
      console.error('Error recording payment link analytics:', error);
    }
  }

  // Record DCA order creation
  static async recordDCAOrder(
    userId: string, 
    walletAddress: string, 
    amount: string, 
    token: 'XFI' | 'USDC'
  ) {
    try {
      // Update global analytics
      const overview = await AnalyticsOverviewModel.findOne();
      if (overview) {
        overview.totalDCAOrders.count += 1;
        overview.totalDCAOrders.totalVolume[token.toLowerCase() as 'xfi' | 'usdc'] = 
          this.addStrings(overview.totalDCAOrders.totalVolume[token.toLowerCase() as 'xfi' | 'usdc'], amount);
        overview.lastUpdated = new Date();
        await overview.save();
      }

      console.log(`📊 Analytics: Recorded DCA order for user ${userId}`);
    } catch (error) {
      console.error('Error recording DCA order analytics:', error);
    }
  }

  // Get analytics overview
  static async getAnalyticsOverview(): Promise<any> {
    try {
      let overview = await AnalyticsOverviewModel.findOne();
      
      if (!overview) {
        // Initialize if it doesn't exist
        await this.initializeAnalytics();
        overview = await AnalyticsOverviewModel.findOne();
      }

      // Get total unique users
      const totalUsers = await UserAnalyticsModel.countDocuments();
      if (overview) {
        overview.totalUsers = totalUsers;
        await overview.save();
      }

      return overview;
    } catch (error) {
      console.error('Error getting analytics overview:', error);
      return null;
    }
  }

  // Get user analytics
  static async getUserAnalytics(userId: string): Promise<UserAnalytics | null> {
    try {
      return await UserAnalyticsModel.findOne({ userId });
    } catch (error) {
      console.error('Error getting user analytics:', error);
      return null;
    }
  }

  // Update total users count
  static async updateTotalUsers() {
    try {
      const totalUsers = await UserAnalyticsModel.countDocuments();
      const overview = await AnalyticsOverviewModel.findOne();
      if (overview) {
        overview.totalUsers = totalUsers;
        overview.lastUpdated = new Date();
        await overview.save();
      }
    } catch (error) {
      console.error('Error updating total users:', error);
    }
  }
} 