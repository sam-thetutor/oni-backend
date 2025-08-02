import fetch from 'node-fetch';

async function testAnalyticsAPI() {
  try {
    console.log('🧪 Testing Analytics API...\n');

    // Test 1: Get analytics overview
    console.log('1️⃣ Testing GET /api/analytics/overview');
    const response = await fetch('http://localhost:3030/api/analytics/overview');
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Analytics overview fetched successfully');
      console.log('📊 Data:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Failed to fetch analytics overview');
      console.log('Error:', data);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Initialize analytics (if needed)
    console.log('2️⃣ Testing POST /api/analytics/initialize');
    const initResponse = await fetch('http://localhost:3030/api/analytics/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const initData = await initResponse.json();
    
    if (initResponse.ok) {
      console.log('✅ Analytics initialized successfully');
      console.log('📊 Response:', JSON.stringify(initData, null, 2));
    } else {
      console.log('❌ Failed to initialize analytics');
      console.log('Error:', initData);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: Get analytics overview again
    console.log('3️⃣ Testing GET /api/analytics/overview (after initialization)');
    const response2 = await fetch('http://localhost:3030/api/analytics/overview');
    const data2 = await response2.json();
    
    if (response2.ok) {
      console.log('✅ Analytics overview fetched successfully after initialization');
      console.log('📊 Data:', JSON.stringify(data2, null, 2));
    } else {
      console.log('❌ Failed to fetch analytics overview after initialization');
      console.log('Error:', data2);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAnalyticsAPI(); 