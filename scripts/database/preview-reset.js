import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config();

async function previewReset() {
  try {
    console.log('🔍 Previewing testnet database reset...');
    
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
    
    if (totalDocuments > 0) {
      console.log(`\n⚠️  WARNING: This will delete ${totalDocuments} documents across ${collections.length} collections!`);
      console.log(`💡 To proceed with the reset, run: node scripts/reset-testnet-db.js`);
    } else {
      console.log(`\n✅ Database is already empty. No reset needed.`);
    }
    
  } catch (error) {
    console.error('❌ Error previewing database:', error);
    throw error;
  } finally {
    // Close the connection
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the preview
previewReset()
  .then(() => {
    console.log('✅ Preview completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Preview failed:', error);
    process.exit(1);
  }); 