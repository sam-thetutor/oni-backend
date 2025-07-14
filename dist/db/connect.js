import mongoose from 'mongoose';
import { config } from 'dotenv';
config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/buai';
export const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB connected successfully');
    }
    catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
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