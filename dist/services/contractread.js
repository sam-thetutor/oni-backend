import { createPublicClient, http } from 'viem';
import { PAYLINK_CONTRACT_ADDRESS } from '../constants/contract.js';
import { PAYLINK_ABI } from '../constants/abi.js';
import dotenv from 'dotenv';
dotenv.config();
const isProduction = process.env.ENVIRONMENT === 'production';
const crossfiChain = {
    id: isProduction
        ? parseInt(process.env.CHAIN_ID || '4158')
        : parseInt(process.env.CHAIN_ID_TESTNET || '4157'),
    name: isProduction ? 'CrossFI Mainnet' : 'CrossFI Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'XFI',
        symbol: 'XFI',
    },
    rpcUrls: {
        default: {
            http: [isProduction
                    ? (process.env.RPC_URL || 'https://rpc.crossfi.org')
                    : (process.env.RPC_URL_TESTNET || 'https://rpc.testnet.ms')
            ],
        },
    },
    blockExplorers: {
        default: {
            name: 'Explorer',
            url: isProduction
                ? (process.env.EXPLORER_URL || 'https://xfiscan.com')
                : (process.env.EXPLORER_URL_TESTNET || 'https://test.xfiscan.com')
        },
    },
};
const STATUS_MAPPING = {
    0: 'active',
    1: 'paid',
    2: 'cancelled'
};
export class ContractReadService {
    publicClient;
    constructor() {
        this.publicClient = createPublicClient({
            chain: crossfiChain,
            transport: http()
        });
    }
    async checkPaymentLinkStatus(linkId) {
        try {
            const exists = await this.publicClient.readContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'fixedinkIDExist',
                args: [linkId],
            });
            if (!exists) {
                return {
                    success: false,
                    error: 'Payment link does not exist on blockchain'
                };
            }
            const result = await this.publicClient.readContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'fixedPaymentLink',
                args: [linkId],
            });
            if (!result || !Array.isArray(result) || result.length !== 4) {
                return {
                    success: false,
                    error: 'Payment link data not found or invalid'
                };
            }
            const [creator, returnedLinkId, amount, status] = result;
            if (!creator || creator === '0x0000000000000000000000000000000000000000' || amount === undefined) {
                return {
                    success: false,
                    error: 'Payment link does not exist on blockchain'
                };
            }
            const amountInXFI = Number(amount) / Math.pow(10, 18);
            return {
                success: true,
                data: {
                    linkId: linkId,
                    creator: creator,
                    amount: amount.toString(),
                    amountInXFI: amountInXFI,
                    status: status === 1 ? 'paid' : 'active',
                    statusCode: status,
                    exists: true,
                    source: 'blockchain'
                }
            };
        }
        catch (error) {
            console.error('ContractReadService: Error checking payment link status:', error);
            let errorMessage = 'Failed to check payment link status from blockchain';
            if (error.message?.includes('execution reverted')) {
                errorMessage = 'Payment link not found on blockchain';
            }
            else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorMessage = 'Network error - unable to connect to blockchain';
            }
            else if (error.message) {
                errorMessage = `Blockchain error: ${error.message}`;
            }
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    async checkGlobalPaymentLinkStatus(linkId) {
        try {
            const result = await this.publicClient.readContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'globalPaymentLink',
                args: [linkId],
            });
            if (!result || !Array.isArray(result) || result.length !== 3) {
                return {
                    success: false,
                    error: 'Global payment link data not found or invalid'
                };
            }
            const [creator, returnedLinkId, totalContributions] = result;
            if (!creator || creator === '0x0000000000000000000000000000000000000000' || totalContributions === undefined) {
                return {
                    success: false,
                    error: 'Global payment link does not exist on blockchain'
                };
            }
            const totalContributionsInXFI = Number(totalContributions) / Math.pow(10, 18);
            return {
                success: true,
                data: {
                    linkId: linkId,
                    creator: creator,
                    totalContributions: totalContributions.toString(),
                    totalContributionsInXFI: totalContributionsInXFI,
                    status: 'active',
                    type: 'global',
                    exists: true,
                    source: 'blockchain'
                }
            };
        }
        catch (error) {
            console.error('ContractReadService: Error checking global payment link status:', error);
            let errorMessage = 'Failed to check global payment link status from blockchain';
            if (error.message?.includes('execution reverted')) {
                errorMessage = 'Global payment link not found on blockchain';
            }
            else if (error.message?.includes('network') || error.message?.includes('fetch')) {
                errorMessage = 'Network error - unable to connect to blockchain';
            }
            else if (error.message) {
                errorMessage = `Blockchain error: ${error.message}`;
            }
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    async getContractBalance() {
        try {
            const balance = await this.publicClient.readContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'getBalance',
                args: [],
            });
            const balanceInXFI = Number(balance) / Math.pow(10, 18);
            return {
                success: true,
                balance: balance.toString(),
                balanceInXFI
            };
        }
        catch (error) {
            console.error('ContractReadService: Error getting contract balance:', error);
            return {
                success: false,
                error: 'Failed to get contract balance'
            };
        }
    }
}
//# sourceMappingURL=contractread.js.map