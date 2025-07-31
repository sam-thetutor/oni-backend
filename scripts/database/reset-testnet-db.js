import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config();

async function resetTestnetDatabase() {
  try {
    console.log('🔄 Starting testnet database reset...');
    
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
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`📋 Found ${collections.length} collections:`);
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    // Drop all collections
    console.log('🗑️  Dropping all collections...');
    for (const collection of collections) {
      console.log(`  - Dropping ${collection.name}...`);
      await db.dropCollection(collection.name);
    }
    
    console.log('✅ All collections dropped successfully');
    
    // Recreate indexes for User model (this will be done automatically when first user is created)
    console.log('🔧 Database reset complete. Indexes will be recreated when first user is created.');
    
    console.log('🎉 Testnet database has been reset successfully!');
    console.log('📝 You can now start fresh with the new frontend wallet address system.');
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    // Close the connection
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the reset
resetTestnetDatabase()
  .then(() => {
    console.log('✅ Database reset completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }); 