import { Types } from 'mongoose';

export interface AnalyticsOverview {
  _id?: Types.ObjectId;
  totalVolumeProcessed: {
    xfi: string; // Total XFI processed
    usdc: string; // Total USDC processed
  };
  totalTransactions: number;
  totalPaymentLinks: {
    count: number;
    totalAmount: {
      xfi: string;
      usdc: string;
    };
  };
  totalDCAOrders: {
    count: number;
    totalVolume: {
      xfi: string;
      usdc: string;
    };
  };
  totalMessages: number;
  totalUsers: number;
  lastUpdated: Date;
}

export interface UserAnalytics {
  _id?: Types.ObjectId;
  userId: string;
  walletAddress: string;
  messageCount: number;
  transactionCount: number;
  totalVolume: {
    xfi: string;
    usdc: string;
  };
  lastActivity: Date;
  createdAt: Date;
}

export interface TransactionRecord {
  _id?: Types.ObjectId;
  userId: string;
  walletAddress: string;
  transactionHash?: string;
  amount: string;
  token: 'XFI' | 'USDC';
  type: 'send' | 'receive' | 'swap' | 'dca';
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
}

export interface MessageRecord {
  _id?: Types.ObjectId;
  userId: string;
  walletAddress: string;
  messageType: 'balance_check' | 'transaction' | 'payment_link' | 'dca' | 'general' | 'other';
  timestamp: Date;
} 