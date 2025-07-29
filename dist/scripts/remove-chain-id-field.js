import { config } from 'dotenv';
import { connectDB } from '../db/connect.js';
import mongoose from 'mongoose';
config();
async function removeChainIdField() {
    try {
        await connectDB();
        console.log(`🔧 Removing chainId field from users collection...`);
        const db = mongoose.connection.db;
        const result = await db.collection('users').updateMany({}, { $unset: { chainId: "" } });
        console.log(`✅ Removed chainId field from ${result.modifiedCount} users`);
        const usersWithChainId = await db.collection('users').find({ chainId: { $exists: true } }).toArray();
        console.log(`  - Users still with chainId field: ${usersWithChainId.length}`);
        if (usersWithChainId.length === 0) {
            console.log('✅ All users have had the chainId field removed successfully');
        }
        else {
            console.log('⚠️  Some users still have the chainId field');
            console.log('Users with chainId:', usersWithChainId.map(u => ({ privyId: u.privyId, chainId: u.chainId })));
        }
        const sampleUsers = await db.collection('users').find().limit(3).toArray();
        console.log('\n📋 Sample users after field removal:');
        sampleUsers.forEach((user, index) => {
            console.log(`  ${index + 1}. ${user.privyId} -> Wallet: ${user.walletAddress}`);
        });
    }
    catch (error) {
        console.error('❌ Error removing chainId field:', error);
        throw error;
    }
}
removeChainIdField()
    .then(() => {
    console.log('✅ Chain ID field removal completed successfully');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ Chain ID field removal failed:', error);
    process.exit(1);
});
//# sourceMappingURL=remove-chain-id-field.js.map