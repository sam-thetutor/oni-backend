import { config } from 'dotenv';
import { connectDB } from '../db/connect.js';
import { User } from '../models/User.js';
config();
async function updateChainIds() {
    try {
        await connectDB();
        console.log(`🔧 Chain ID Update Script`);
        console.log(`  - Environment: ${process.env.ENVIRONMENT}`);
        console.log(`  - Note: Chain ID is now managed at the service level, not per user`);
        const totalUsers = await User.countDocuments();
        console.log(`  - Total users in database: ${totalUsers}`);
        const sampleUsers = await User.find().limit(3);
        console.log('\n📋 Sample users:');
        sampleUsers.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.privyId} -> Wallet: ${user.walletAddress}`);
        });
        console.log('\n✅ Chain ID management has been moved to the service level.');
        console.log('   Each service now uses environment-aware chain ID configuration.');
    }
    catch (error) {
        console.error('❌ Error in chain ID script:', error);
        throw error;
    }
}
updateChainIds()
    .then(() => {
    console.log('✅ Chain ID script completed successfully');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ Chain ID script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=update-chain-ids.js.map