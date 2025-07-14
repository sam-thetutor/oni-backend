import { createPublicClient, createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { EncryptionService } from '../utils/encryption.js';
const RPC_URL = process.env.RPC_URL || 'https://rpc.testnet.ms';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '4157');
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
            name: 'CrossFi Explorer',
            url: 'https://test.xfiscan.com',
        },
    },
});
export const publicClient = createPublicClient({
    chain: crossfi,
    transport: http(RPC_URL),
});
export function createWalletClientFromPrivateKey(privateKey) {
    console.log('Creating wallet client from private key:', privateKey);
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