import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

async function testBackendIntegration() {
  console.log('🧪 Testing Backend Integration with Intelligent Tool...\n');

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3030';
  
  // Test messages that should trigger the intelligent tool
  const testMessages = [
    "What's my wallet balance?",
    "Show my wallet address",
    "Create a payment link for 25 XFI",
    "Show my transaction history"
  ];

  console.log(`📍 Backend URL: ${backendUrl}`);
  console.log('⚠️  Note: This test requires a valid authentication token and wallet connection\n');

  for (const message of testMessages) {
    console.log(`📝 Testing: "${message}"`);
    
    try {
      const response = await fetch(`${backendUrl}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
        },
        body: JSON.stringify({ message })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Response: ${data.response.substring(0, 100)}...`);
      } else {
        console.log(`❌ HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    console.log('---\n');
  }

  console.log('🏁 Backend integration test completed!');
  console.log('💡 To test with real authentication, replace YOUR_TOKEN_HERE with a valid token');
}

testBackendIntegration(); 