import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

// Environment-aware database configuration
const isProduction = process.env.ENVIRONMENT === 'production';
const MONGODB_URI = isProduction 
  ? (process.env.MONGODB_URI || 'mongodb://localhost:27017/oni_production')
  : (process.env.MONGODB_URI_TESTNET || 'mongodb://localhost:27017/oni_testnet');

console.log(`🌍 Environment: ${isProduction ? 'Production' : 'Development/Testnet'}`);
console.log(`🗄️  Database: ${MONGODB_URI}`);

export const connectDB = async (): Promise<void> => {
  try {
    // MongoDB connection options for newer MongoDB driver
    const options = {
      // Connection pool options
      maxPoolSize: 10,
      minPoolSize: 1,
      // Timeout options
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Retry options
      retryWrites: true,
      retryReads: true,
      // Write concern
      w: 'majority' as const,
    };

    await mongoose.connect(MONGODB_URI, options);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error; // Re-throw the error instead of exiting
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected successfully');
  } catch (error) {
    console.error('❌ MongoDB disconnection error:', error);
  }
}; 