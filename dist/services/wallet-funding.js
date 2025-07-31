import { parseEther, formatEther } from 'viem';
import { config } from 'dotenv';
import { createWalletClientFromPrivateKey, publicClient } from '../config/viem.js';
config();
export class WalletFundingService {
    static async fundNewWallet(userWalletAddress) {
        try {
            const fundingAmount = process.env.FUNDING_AMOUNT || '0.01';
            console.log(`💰 Funding new wallet: ${userWalletAddress}`);
            console.log(`📊 Amount: ${fundingAmount} XFI`);
            const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY || 'd0e9117cf353f4895f7a0280b5dab7fd88c19202c43e03be8aefca0c89f7c9d5';
            const fundingWalletClient = createWalletClientFromPrivateKey(fundingPrivateKey.startsWith('0x') ? fundingPrivateKey : `0x${fundingPrivateKey}`);
            if (!fundingWalletClient) {
                throw new Error('Failed to create funding wallet client');
            }
            const fundingAddress = fundingWalletClient.account.address;
            const fundingBalance = await publicClient.getBalance({ address: fundingAddress });
            const requiredAmount = parseEther(fundingAmount);
            console.log(`🔍 Funding wallet balance: ${formatEther(fundingBalance)} XFI`);
            console.log(`📋 Required amount: ${fundingAmount} XFI`);
            if (fundingBalance < requiredAmount) {
                throw new Error(`Insufficient balance in funding wallet. Have: ${formatEther(fundingBalance)}, Need: ${fundingAmount}`);
            }
            const hash = await fundingWalletClient.sendTransaction({
                to: userWalletAddress,
                value: requiredAmount,
            });
            console.log(`✅ Funding transaction sent: ${hash}`);
            return {
                success: true,
                transactionHash: hash,
                amount: fundingAmount,
                toAddress: userWalletAddress,
            };
        }
        catch (error) {
            console.error('❌ Error funding new wallet:', error);
            const fundingAmount = process.env.FUNDING_AMOUNT || '0.01';
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                amount: fundingAmount,
                toAddress: userWalletAddress,
            };
        }
    }
    static async checkWalletFunding(walletAddress) {
        try {
            const balance = await publicClient.getBalance({ address: walletAddress });
            const hasBalance = balance > 0n;
            console.log(`🔍 Wallet ${walletAddress} balance: ${formatEther(balance)} XFI`);
            console.log(`📊 Has been funded: ${hasBalance}`);
            return hasBalance;
        }
        catch (error) {
            console.error('❌ Error checking wallet funding:', error);
            return false;
        }
    }
    static async getFundingWalletBalance() {
        try {
            const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY || 'd0e9117cf353f4895f7a0280b5dab7fd88c19202c43e03be8aefca0c89f7c9d5';
            const fundingWalletClient = createWalletClientFromPrivateKey(fundingPrivateKey.startsWith('0x') ? fundingPrivateKey : `0x${fundingPrivateKey}`);
            if (!fundingWalletClient) {
                throw new Error('Failed to create funding wallet client');
            }
            const balance = await publicClient.getBalance({ address: fundingWalletClient.account.address });
            return formatEther(balance);
        }
        catch (error) {
            console.error('❌ Error getting funding wallet balance:', error);
            throw error;
        }
    }
    static getFundingWalletAddress() {
        try {
            const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY || 'd0e9117cf353f4895f7a0280b5dab7fd88c19202c43e03be8aefca0c89f7c9d5';
            const fundingWalletClient = createWalletClientFromPrivateKey(fundingPrivateKey.startsWith('0x') ? fundingPrivateKey : `0x${fundingPrivateKey}`);
            if (!fundingWalletClient) {
                throw new Error('Failed to create funding wallet client');
            }
            return fundingWalletClient.account.address;
        }
        catch (error) {
            console.error('❌ Error getting funding wallet address:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=wallet-funding.js.map