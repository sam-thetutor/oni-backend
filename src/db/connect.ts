import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

const isProduction = process.env.ENVIRONMENT === 'production';
console.log(`🌍 Environment: ${isProduction ? 'Production' : 'Development/Testnet'}`);
console.log(`🗄️  Database: MongoDB`);

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
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