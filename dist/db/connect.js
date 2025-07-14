import mongoose from 'mongoose';
import { config } from 'dotenv';
config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/buai';
export const connectDB = async () => {
    try {
        if (mongoose.connection.readyState === 1) {
            console.log('✅ MongoDB already connected');
            return;
        }
        mongoose.set('bufferCommands', false);
        await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
        });
        console.log('✅ MongoDB connected successfully');
    }
    catch (error) {
        console.error('❌ MongoDB connection error:', error);
        if (process.env.NODE_ENV === 'production') {
            console.error('Continuing without database connection in production');
        }
        else {
            process.exit(1);
        }
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