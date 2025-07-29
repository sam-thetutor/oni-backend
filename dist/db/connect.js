import mongoose from 'mongoose';
import { config } from 'dotenv';
config();
const isProduction = process.env.ENVIRONMENT === 'production';
const MONGODB_URI = isProduction
    ? (process.env.MONGODB_URI || 'mongodb://localhost:27017/oni_production')
    : (process.env.MONGODB_URI_TESTNET || 'mongodb://localhost:27017/oni_testnet');
console.log(`🌍 Environment: ${isProduction ? 'Production' : 'Development/Testnet'}`);
console.log(`🗄️  Database: ${MONGODB_URI}`);
export const connectDB = async () => {
    try {
        const options = {
            maxPoolSize: 10,
            minPoolSize: 1,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            retryReads: true,
            w: 'majority',
        };
        await mongoose.connect(MONGODB_URI, options);
        console.log('✅ MongoDB connected successfully');
    }
    catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
};
export const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('✅ MongoDB disconnected successfully');
    }
    catch (error) {
        console.error('❌ MongoDB disconnection error:', error);
    }
};
//# sourceMappingURL=connect.js.map