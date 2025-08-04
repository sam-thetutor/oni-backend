import { config } from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
config();

async function checkDCAOrders() {
  console.log('🔍 CHECKING DCA ORDERS FOR WALLET');
  console.log('=' .repeat(50));
  console.log(`Wallet Address: 0x514D8876eAe2B500F756769b23345602dFF7dA82`);
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Import the DCA model
    const { DCAOrder } = await import('./src/models/DCAOrder.js');
    
    // Check for orders with this wallet address
    const walletOrders = await DCAOrder.find({
      walletAddress: '0x514D8876eAe2B500F756769b23345602dFF7dA82'
    }).lean();
    
    console.log(`📊 Found ${walletOrders.length} DCA orders for this wallet`);
    
    if (walletOrders.length > 0) {
      console.log('\n📋 DCA Orders for wallet 0x514D8876eAe2B500F756769b23345602dFF7dA82:');
      walletOrders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order ID: ${order._id}`);
        console.log(`   User ID: ${order.userId}`);
        console.log(`   Wallet Address: ${order.walletAddress}`);
        console.log(`   Order Type: ${order.orderType}`);
        console.log(`   From Token: ${order.fromToken}`);
        console.log(`   To Token: ${order.toToken}`);
        console.log(`   From Amount: ${order.fromAmount}`);
        console.log(`   Trigger Price: ${order.triggerPrice}`);
        console.log(`   Trigger Condition: ${order.triggerCondition}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Created At: ${order.createdAt}`);
      });
    } else {
      console.log('❌ No DCA orders found for this wallet address');
      
      // Check all DCA orders to see what's in the database
      const allOrders = await DCAOrder.find({}).lean();
      console.log(`\n📊 Total DCA orders in database: ${allOrders.length}`);
      
      if (allOrders.length > 0) {
        console.log('\n📋 All DCA Orders in Database:');
        allOrders.forEach((order, index) => {
          console.log(`\n${index + 1}. Order ID: ${order._id}`);
          console.log(`   User ID: ${order.userId}`);
          console.log(`   Wallet Address: ${order.walletAddress}`);
          console.log(`   Order Type: ${order.orderType}`);
          console.log(`   From Token: ${order.fromToken}`);
          console.log(`   To Token: ${order.toToken}`);
          console.log(`   Status: ${order.status}`);
        });
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ MongoDB connection closed');
    
  } catch (error) {
    console.error('❌ Error checking DCA orders:', error);
  }
}

checkDCAOrders(); 