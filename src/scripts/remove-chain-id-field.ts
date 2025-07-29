import { config } from 'dotenv';
import { connectDB } from '../db/connect.js';
import mongoose from 'mongoose';

// Load environment variables
config();

async function removeChainIdField() {
  try {
    // Connect to database
    await connectDB();
    
    console.log(`🔧 Removing chainId field from users collection...`);
    
    // Get the database connection
    const db = mongoose.connection.db;
    
    // Remove the chainId field from all users using native MongoDB
    const result = await db.collection('users').updateMany(
      {}, // Update all documents
      { $unset: { chainId: "" } } // Remove the chainId field
    );
    
    console.log(`✅ Removed chainId field from ${result.modifiedCount} users`);
    
    // Verify the field is removed
    const usersWithChainId = await db.collection('users').find({ chainId: { $exists: true } }).toArray();
    console.log(`  - Users still with chainId field: ${usersWithChainId.length}`);
    
    if (usersWithChainId.length === 0) {
      console.log('✅ All users have had the chainId field removed successfully');
    } else {
      console.log('⚠️  Some users still have the chainId field');
      console.log('Users with chainId:', usersWithChainId.map(u => ({ privyId: u.privyId, chainId: u.chainId })));
    }
    
    // Show sample users
    const sampleUsers = await db.collection('users').find().limit(3).toArray();
    console.log('\n📋 Sample users after field removal:');
    sampleUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.privyId} -> Wallet: ${user.walletAddress}`);
    });
    
  } catch (error) {
    console.error('❌ Error removing chainId field:', error);
    throw error;
  }
}

// Run the migration
removeChainIdField()
  .then(() => {
    console.log('✅ Chain ID field removal completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Chain ID field removal failed:', error);
    process.exit(1);
  }); 