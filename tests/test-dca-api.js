import { config } from 'dotenv';
import { MongoClient } from 'mongodb';

// Load environment variables
config();

async function testDCAAPI() {
  console.log('🔍 TESTING DCA API ENDPOINT');
  console.log('=' .repeat(50));
  
  try {
    // Connect to MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('crossfi');
    const dcaOrdersCollection = db.collection('dcaorders');
    
    // Check if there are any DCA orders in the database
    const totalOrders = await dcaOrdersCollection.countDocuments();
    console.log(`📊 Total DCA orders in database: ${totalOrders}`);
    
    if (totalOrders > 0) {
      // Get all orders
      const allOrders = await dcaOrdersCollection.find({}).toArray();
      console.log('\n📋 All DCA Orders:');
      allOrders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order ID: ${order._id}`);
        console.log(`   User ID: ${order.userId}`);
        console.log(`   Order Type: ${order.orderType}`);
        console.log(`   From Token: ${order.fromToken}`);
        console.log(`   To Token: ${order.toToken}`);
        console.log(`   From Amount: ${order.fromAmount}`);
        console.log(`   Trigger Price: ${order.triggerPrice}`);
        console.log(`   Trigger Condition: ${order.triggerCondition}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Created At: ${order.createdAt}`);
      });
      
      // Check for orders with specific user
      const userOrders = await dcaOrdersCollection.find({
        userId: '0x85A4b09fb0788f1C549a68dC2EdAe3F97aeb5Dd7'
      }).toArray();
      
      console.log(`\n👤 Orders for user 0x85A4b09fb0788f1C549a68dC2EdAe3F97aeb5Dd7: ${userOrders.length}`);
      
      if (userOrders.length > 0) {
        console.log('\n📋 User Orders:');
        userOrders.forEach((order, index) => {
          console.log(`\n${index + 1}. Order ID: ${order._id}`);
          console.log(`   Order Type: ${order.orderType}`);
          console.log(`   From Token: ${order.fromToken}`);
          console.log(`   To Token: ${order.toToken}`);
          console.log(`   Status: ${order.status}`);
        });
      }
    }
    
    await client.close();
    console.log('\n✅ MongoDB connection closed');
    
  } catch (error) {
    console.error('❌ Error testing DCA API:', error);
  }
}

testDCAAPI(); 