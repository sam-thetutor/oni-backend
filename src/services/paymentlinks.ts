import { PaymentLink } from "../models/PaymentLink.js";
import { createWalletClientFromPrivateKey } from '../config/viem.js';

interface IPaymentLink {
  linkId: string;
  userId: string;
  amount: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export class PaymentLinkService {
    static async createPaymentLink(userId: string, amount: number, linkID: string): Promise<IPaymentLink> {
         const paymentLink = await PaymentLink.create({
            linkId: linkID,
            userId,
            amount,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Award points for payment link creation
        try {
            const { GamificationService } = await import('./gamification.js');
            const { User } = await import('../models/User.js');
            
            const user = await User.findOne({ walletAddress: userId });
            if (user) {
                const reward = await GamificationService.awardPaymentLinkPoints(user, false); // false = fixed payment link
                console.log(`🎯 Payment link points awarded: ${reward.totalPoints} points (${reward.reason})`);
            }
        } catch (error) {
            console.error('❌ Failed to award payment link points:', error);
            // Don't fail the payment link creation if points awarding fails
        }

        return paymentLink as IPaymentLink;
    }

    static async createPaymentLinkOnChain(privateKey: string, linkID: string, amount: string): Promise<string> {
        try {
        
            
            // Use viem's wallet client which handles CrossFI properly
            const walletClient = createWalletClientFromPrivateKey(privateKey);
            
            if (!walletClient.account) {
                throw new Error('No account found in wallet client');
            }

            // Import viem utilities
            const { parseEther } = await import('viem');
            const { PAYLINK_CONTRACT_ADDRESS } = await import('../constants/contract.js');
            const { PAYLINK_ABI } = await import('../constants/abi.js');

            // Convert amount to Wei using viem
            const amountInWei = parseEther(amount);

            // Call the smart contract using viem
            const hash = await walletClient.writeContract({
                address: PAYLINK_CONTRACT_ADDRESS as `0x${string}`,
                abi: PAYLINK_ABI,
                functionName: 'createFixedPaymentLink',
                args: [linkID, amountInWei],
            } as any);


            return hash;
        } catch (error: any) {
            console.error('Error creating payment link on chain:', error.message);
            throw new Error(`Failed to create payment link on chain: ${error.message}`);
        }
    }

    static async createGlobalPaymentLinkOnChain(privateKey: string, linkID: string): Promise<string> {
        try {
            // Use viem's wallet client which handles CrossFI properly
            const walletClient = createWalletClientFromPrivateKey(privateKey);
            
            if (!walletClient.account) {
                throw new Error('No account found in wallet client');
            }

            // Import required modules
            const { PAYLINK_CONTRACT_ADDRESS } = await import('../constants/contract.js');
            const { PAYLINK_ABI } = await import('../constants/abi.js');

            // Call the smart contract using viem - global payment links don't require an amount
            const hash = await walletClient.writeContract({
                address: PAYLINK_CONTRACT_ADDRESS as `0x${string}`,
                abi: PAYLINK_ABI,
                functionName: 'createGlobalPaymentLink',
                args: [linkID],
            } as any);


            return hash;
        } catch (error: any) {
            console.error('Error creating global payment link on chain:', error.message);
            throw new Error(`Failed to create global payment link on chain: ${error.message}`);
        }
    }

    static async createGlobalPaymentLink(userId: string, linkID: string): Promise<IPaymentLink> {
        const paymentLink = await PaymentLink.create({
            linkId: linkID,
            userId,
            amount: 0, // Global payment links start with 0 amount
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Award points for global payment link creation
        try {
            const { GamificationService } = await import('./gamification.js');
            const { User } = await import('../models/User.js');
            
            const user = await User.findOne({ walletAddress: userId });
            if (user) {
                const reward = await GamificationService.awardPaymentLinkPoints(user, true); // true = global payment link
                console.log(`🎯 Global payment link points awarded: ${reward.totalPoints} points (${reward.reason})`);
            }
        } catch (error) {
            console.error('❌ Failed to award global payment link points:', error);
            // Don't fail the payment link creation if points awarding fails
        }

        return paymentLink as IPaymentLink;
    }

    static async contributeToGlobalPaymentLinkOnChain(privateKey: string, linkID: string, amount: string): Promise<string> {
        try {
            // Use viem's wallet client which handles CrossFI properly
            const walletClient = createWalletClientFromPrivateKey(privateKey);
            
            if (!walletClient.account) {
                throw new Error('No account found in wallet client');
            }

            // Import viem utilities
            const { parseEther } = await import('viem');
            const { PAYLINK_CONTRACT_ADDRESS } = await import('../constants/contract.js');
            const { PAYLINK_ABI } = await import('../constants/abi.js');

            // Convert amount to Wei using viem
            const amountInWei = parseEther(amount);

            // Call the smart contract using viem - contributeToGlobalPaymentLink is payable
            const hash = await walletClient.writeContract({
                address: PAYLINK_CONTRACT_ADDRESS as `0x${string}`,
                abi: PAYLINK_ABI,
                functionName: 'contributeToGlobalPaymentLink',
                args: [linkID],
                value: amountInWei, // Send the XFI amount as value
            } as any);


            return hash;
        } catch (error: any) {
            console.error('Error contributing to global payment link on chain:', error.message);
            throw new Error(`Failed to contribute to global payment link on chain: ${error.message}`);
        }
    }
}