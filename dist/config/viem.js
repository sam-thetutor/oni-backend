import { createPublicClient, createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from 'dotenv';
import { EncryptionService } from '../utils/encryption.js';
config();
const isProduction = process.env.ENVIRONMENT === 'production';
const RPC_URL = isProduction
    ? (process.env.RPC_URL || 'https://rpc.mainnet.ms')
    : (process.env.RPC_URL_TESTNET || 'https://rpc.testnet.ms');
const CHAIN_ID = isProduction
    ? parseInt(process.env.CHAIN_ID || '4158')
    : parseInt(process.env.CHAIN_ID_TESTNET || '4157');
const crossfi = defineChain({
    id: CHAIN_ID,
    name: 'CrossFi',
    network: 'crossfi',
    nativeCurrency: {
        decimals: 18,
        name: 'CrossFi',
        symbol: 'XFI',
    },
    rpcUrls: {
        default: {
            http: [RPC_URL],
        },
        public: {
            http: [RPC_URL],
        },
    },
    blockExplorers: {
        default: {
            name: isProduction ? 'CrossFi Explorer' : 'CrossFi Testnet Explorer',
            url: isProduction ? 'https://xfiscan.com' : 'https://test.xfiscan.com',
        },
    },
});
export const publicClient = createPublicClient({
    chain: crossfi,
    transport: http(RPC_URL),
});
export function createWalletClientFromPrivateKey(privateKey) {
    let decryptedPrivateKey = privateKey;
    if (EncryptionService.isEncrypted(privateKey)) {
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY environment variable is required');
        }
        decryptedPrivateKey = EncryptionService.decryptPrivateKey(privateKey, encryptionKey);
    }
    const account = privateKeyToAccount(decryptedPrivateKey);
    return createWalletClient({
        account,
        chain: crossfi,
        transport: http(RPC_URL),
    });
}
export async function getWalletClientFromUser(user) {
    try {
        if (!user?.encryptedPrivateKey) {
            console.error('No encrypted private key found for user');
            return null;
        }
        const privateKey = user.encryptedPrivateKey;
        return createWalletClientFromPrivateKey(privateKey);
    }
    catch (error) {
        console.error('Error creating wallet client:', error);
        return null;
    }
}
export const chainConfig = crossfi;
//# sourceMappingURL=viem.js.map