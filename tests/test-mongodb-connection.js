import { config } from 'dotenv';
import mongoose from 'mongoose';

config();

async function testMongoDBConnection() {
  console.log('🔧 Testing MongoDB Connection...');
  console.log(`Environment: ${process.env.ENVIRONMENT}`);
  console.log(`MongoDB URI: ${process.env.MONGODB_URI || 'NOT SET'}`);
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully!');
    
    // Test a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📚 Available collections:', collections.map(c => c.name));
    
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected successfully!');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
}

testMongoDBConnection(); 