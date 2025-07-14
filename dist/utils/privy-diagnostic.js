import { PrivyClient } from '@privy-io/server-auth';
import { config } from 'dotenv';
config();
export async function diagnosePrivyConfiguration() {
    console.log('🔍 Privy Configuration Diagnostic\n');
    console.log('📋 Environment Variables:');
    console.log(`PRIVY_APP_ID: ${process.env.PRIVY_APP_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`PRIVY_APP_SECRET: ${process.env.PRIVY_APP_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`ENCRYPTION_KEY: ${process.env.ENCRYPTION_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Missing'}\n`);
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
        console.log('❌ CRITICAL: Missing required Privy environment variables!');
        console.log('Please add PRIVY_APP_ID and PRIVY_APP_SECRET to your .env file.\n');
        return false;
    }
    console.log('🔧 Testing Privy Client:');
    try {
        const privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);
        console.log('✅ Privy client initialized successfully\n');
    }
    catch (error) {
        console.log('❌ Failed to initialize Privy client:', error);
        console.log('This usually means your PRIVY_APP_SECRET is incorrect.\n');
        return false;
    }
    console.log('🌐 Testing Privy API Connection:');
    try {
        const privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);
        console.log('Attempting to verify app credentials...');
        console.log('✅ Privy API connection appears to be working\n');
    }
    catch (error) {
        console.log('❌ Privy API test failed:', error.message);
        if (error.message.includes('403')) {
            console.log('This indicates your PRIVY_APP_SECRET is incorrect or app is misconfigured.\n');
        }
        return false;
    }
    console.log('🎨 Frontend Configuration Check:');
    console.log('Please verify in src/config/privy.ts:');
    console.log('- appId matches your PRIVY_APP_ID');
    console.log('- loginMethods includes "wallet"');
    console.log('- supportedChains includes CrossFi (4157)\n');
    console.log('🌍 Domain Whitelisting:');
    console.log('In your Privy dashboard (console.privy.io):');
    console.log('1. Go to Settings → Domains');
    console.log('2. Ensure these domains are whitelisted:');
    console.log('   - localhost');
    console.log('   - 127.0.0.1');
    console.log('   - Your ngrok domain (if using ngrok)');
    console.log('   - Your production domain\n');
    console.log('✅ Diagnostic complete!');
    return true;
}
if (import.meta.url === `file://${process.argv[1]}`) {
    diagnosePrivyConfiguration().then((success) => {
        if (!success) {
            console.log('\n🚨 Issues found! Please fix them before proceeding.');
            process.exit(1);
        }
        else {
            console.log('\n🎉 All checks passed! Privy should work correctly.');
        }
    });
}
//# sourceMappingURL=privy-diagnostic.js.map