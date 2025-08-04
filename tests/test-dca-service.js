import { config } from 'dotenv';
import { DCAService } from './src/services/dca.js';

// Load environment variables
config();

async function testDCAService() {
  console.log('🔍 TESTING DCA SERVICE');
  console.log('=' .repeat(50));
  
  try {
    const userId = '0x85A4b09fb0788f1C549a68dC2EdAe3F97aeb5Dd7';
    
    console.log(`👤 Testing for user: ${userId}`);
    
    // Get user DCA orders
    const orders = await DCAService.getUserDCAOrders(userId);
    
    console.log(`📊 Found ${orders.length} DCA orders`);
    
    if (orders.length > 0) {
      console.log('\n📋 User DCA Orders:');
      orders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order ID: ${order.id}`);
        console.log(`   Order Type: ${order.orderType}`);
        console.log(`   From Token: ${order.fromToken}`);
        console.log(`   To Token: ${order.toToken}`);
        console.log(`   From Amount: ${order.fromAmount}`);
        console.log(`   From Amount Formatted: ${order.fromAmountFormatted}`);
        console.log(`   Trigger Price: ${order.triggerPrice}`);
        console.log(`   Trigger Condition: ${order.triggerCondition}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Created At: ${order.createdAt}`);
      });
    } else {
      console.log('❌ No DCA orders found for this user');
    }
    
  } catch (error) {
    console.error('❌ Error testing DCA service:', error);
  }
}

testDCAService(); 