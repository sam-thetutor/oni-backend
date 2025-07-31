import mongoose from 'mongoose';
import { config } from 'dotenv';
import readline from 'readline';

// Load environment variables
config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask for user confirmation
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function resetProductionDatabase() {
  try {
    console.log('🚨 PRODUCTION DATABASE RESET 🚨');
    console.log('================================');
    
    // Check environment
    const environment = process.env.ENVIRONMENT || 'development';
    if (environment !== 'production') {
      console.log('⚠️  WARNING: This script is designed for production use.');
      console.log(`   Current environment: ${environment}`);
      
      const confirm = await askQuestion('Do you want to continue anyway? (yes/no): ');
      if (confirm.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled.');
        return;
      }
    }
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }
    
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Get the database instance
    const db = mongoose.connection.db;
    
    // List all collections with their document counts
    const collections = await db.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections:`);
    
    let totalDocuments = 0;
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      totalDocuments += count;
      console.log(`  - ${collection.name}: ${count} documents`);
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Total collections: ${collections.length}`);
    console.log(`  - Total documents: ${totalDocuments}`);
    console.log(`  - Database: ${db.databaseName}`);
    console.log(`  - Environment: ${environment}`);
    
    if (totalDocuments === 0) {
      console.log('\n✅ Database is already empty. No reset needed.');
      return;
    }
    
    // Final confirmation
    console.log('\n🚨 FINAL WARNING 🚨');
    console.log('This will PERMANENTLY DELETE all data from the production database!');
    console.log('This action cannot be undone.');
    
    const finalConfirm = await askQuestion('Type "RESET-PRODUCTION" to confirm: ');
    if (finalConfirm !== 'RESET-PRODUCTION') {
      console.log('❌ Operation cancelled. Incorrect confirmation code.');
      return;
    }
    
    // Drop all collections
    console.log('\n🗑️  Dropping all collections...');
    for (const collection of collections) {
      console.log(`  - Dropping ${collection.name}...`);
      await db.dropCollection(collection.name);
    }
    
    console.log('✅ All collections dropped successfully');
    
    // Verify reset
    const remainingCollections = await db.listCollections().toArray();
    console.log(`\n🔍 Verification: ${remainingCollections.length} collections remaining`);
    
    if (remainingCollections.length === 0) {
      console.log('🎉 Production database has been reset successfully!');
      console.log('📝 You can now start fresh with the new frontend wallet address system.');
    } else {
      console.log('⚠️  Some collections may still exist. Manual verification recommended.');
    }
    
  } catch (error) {
    console.error('❌ Error resetting production database:', error);
    throw error;
  } finally {
    // Close the connection and readline interface
    await mongoose.disconnect();
    rl.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the reset
resetProductionDatabase()
  .then(() => {
    console.log('✅ Production database reset completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Production database reset failed:', error);
    process.exit(1);
  }); 