import { parseEther, formatEther } from 'viem';
import { publicClient, getWalletClientFromUser } from '../config/viem.js';
import { GamificationService } from './gamification.js';
const EXPLORER_BASE_URL = 'https://test.xfiscan.com/tx/';
export class BlockchainService {
    static async getBalance(address) {
        try {
            const balance = await publicClient.getBalance({ address: address });
            return {
                address,
                balance: balance.toString(),
                formatted: formatEther(balance),
            };
        }
        catch (error) {
            console.error('Error getting balance:', error);
            throw new Error('Failed to get balance');
        }
    }
    static async getBalances(addresses) {
        try {
            const balancePromises = addresses.map(address => this.getBalance(address));
            return await Promise.all(balancePromises);
        }
        catch (error) {
            console.error('Error getting balances:', error);
            throw new Error('Failed to get balances');
        }
    }
    static async sendTransaction(user, to, amount, data) {
        try {
            const walletClient = await getWalletClientFromUser(user);
            if (!walletClient) {
                throw new Error('Failed to create wallet client');
            }
            const account = walletClient.account;
            if (!account) {
                throw new Error('No account found in wallet client');
            }
            const hash = await walletClient.sendTransaction({
                to: to,
                value: parseEther(amount),
                ...(data && { data: data }),
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            let reward = null;
            if (receipt.status === 'success') {
                try {
                    reward = await GamificationService.awardTransactionPoints(user, amount);
                }
                catch (error) {
                    console.error('Failed to award points:', error);
                }
            }
            return {
                hash: receipt.transactionHash,
                from: receipt.from,
                to: receipt.to || '',
                value: amount,
                status: receipt.status === 'success' ? 'success' : 'failed',
                reward: reward,
                transactionUrl: `${EXPLORER_BASE_URL}${receipt.transactionHash}`,
            };
        }
        catch (error) {
            console.error('Error sending transaction:', error);
            throw new Error('Failed to send transaction');
        }
    }
    static async getTransactionHistory(address, limit = 10) {
        try {
            const blockNumber = await publicClient.getBlockNumber();
            const transactions = [];
            const blocksToCheck = Math.min(limit * 2, 100);
            for (let i = 0; i < blocksToCheck && transactions.length < limit; i++) {
                const block = await publicClient.getBlock({
                    blockNumber: blockNumber - BigInt(i),
                    includeTransactions: true,
                });
                if (block.transactions) {
                    for (const tx of block.transactions) {
                        if (typeof tx === 'object' && tx.from?.toLowerCase() === address.toLowerCase()) {
                            transactions.push({
                                hash: tx.hash,
                                from: tx.from,
                                to: tx.to || '',
                                value: formatEther(tx.value),
                                status: 'success',
                            });
                            if (transactions.length >= limit)
                                break;
                        }
                    }
                }
            }
            return transactions;
        }
        catch (error) {
            console.error('Error getting transaction history:', error);
            throw new Error('Failed to get transaction history');
        }
    }
    static async estimateGas(from, to, amount, data) {
        try {
            const gasEstimate = await publicClient.estimateGas({
                account: from,
                to: to,
                value: parseEther(amount),
                ...(data && { data: data }),
            });
            return gasEstimate;
        }
        catch (error) {
            console.error('Error estimating gas:', error);
            throw new Error('Failed to estimate gas');
        }
    }
    static async getGasPrice() {
        try {
            return await publicClient.getGasPrice();
        }
        catch (error) {
            console.error('Error getting gas price:', error);
            throw new Error('Failed to get gas price');
        }
    }
    static async getBlockInfo(blockNumber) {
        try {
            const block = await publicClient.getBlock({
                blockNumber: blockNumber || await publicClient.getBlockNumber(),
            });
            return {
                number: block.number,
                hash: block.hash,
                timestamp: block.timestamp,
                transactions: block.transactions.length,
            };
        }
        catch (error) {
            console.error('Error getting block info:', error);
            throw new Error('Failed to get block information');
        }
    }
    static isValidAddress(address) {
        try {
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        }
        catch {
            return false;
        }
    }
    static formatAddress(address) {
        if (!this.isValidAddress(address)) {
            return address;
        }
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
}
//# sourceMappingURL=blockchain.js.map