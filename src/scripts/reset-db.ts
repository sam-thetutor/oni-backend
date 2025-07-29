import mongoose from 'mongoose';
import { config } from 'dotenv';
import { connectDB, disconnectDB } from '../db/connect.js';

config();

async function resetUserCollection() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    console.log('🗑️ Dropping existing User collection...');
    try {
      await db.dropCollection('users');
      console.log('✅ User collection dropped successfully');
    } catch (error: any) {
      if (error.code === 26) {
        console.log('ℹ️  User collection does not exist, skipping...');
      } else {
        throw error;
      }
    }
    
    console.log('🗑️ Dropping existing PaymentLink collection...');
    try {
      await db.dropCollection('paymentlinks');
      console.log('✅ PaymentLink collection dropped successfully');
    } catch (error: any) {
      if (error.code === 26) {
        console.log('ℹ️  PaymentLink collection does not exist, skipping...');
      } else {
        throw error;
      }
    }
    
    console.log('🗑️ Dropping existing DCAOrder collection...');
    try {
      await db.dropCollection('dcaorders');
      console.log('✅ DCAOrder collection dropped successfully');
    } catch (error: any) {
      if (error.code === 26) {
        console.log('ℹ️  DCAOrder collection does not exist, skipping...');
      } else {
        throw error;
      }
    }
    
    console.log('🗑️ Dropping existing PriceData collection...');
    try {
      await db.dropCollection('pricedatas');
      console.log('✅ PriceData collection dropped successfully');
    } catch (error: any) {
      if (error.code === 26) {
        console.log('ℹ️  PriceData collection does not exist, skipping...');
      } else {
        throw error;
      }
    }
    
    console.log('🔄 Disconnecting from database...');
    await disconnectDB();
    
    console.log('✅ Database reset completed successfully');
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
}

resetUserCollection(); 