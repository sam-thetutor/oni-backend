import { PaymentLink } from "../models/PaymentLink.js";
import { createWalletClientFromPrivateKey } from '../config/viem.js';
export class PaymentLinkService {
    static async createPaymentLink(userId, amount, linkID) {
        const paymentLink = await PaymentLink.create({
            linkId: linkID,
            userId,
            amount,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return paymentLink;
    }
    static async createPaymentLinkOnChain(privateKey, linkID, amount) {
        try {
            const walletClient = createWalletClientFromPrivateKey(privateKey);
            if (!walletClient.account) {
                throw new Error('No account found in wallet client');
            }
            const { parseEther } = await import('viem');
            const { PAYLINK_CONTRACT_ADDRESS } = await import('../constants/contract.js');
            const { PAYLINK_ABI } = await import('../constants/abi.js');
            const amountInWei = parseEther(amount);
            const hash = await walletClient.writeContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'createFixedPaymentLink',
                args: [linkID, amountInWei],
            });
            return hash;
        }
        catch (error) {
            console.error('Error creating payment link on chain:', error.message);
            throw new Error(`Failed to create payment link on chain: ${error.message}`);
        }
    }
    static async createGlobalPaymentLinkOnChain(privateKey, linkID) {
        try {
            const walletClient = createWalletClientFromPrivateKey(privateKey);
            if (!walletClient.account) {
                throw new Error('No account found in wallet client');
            }
            const { PAYLINK_CONTRACT_ADDRESS } = await import('../constants/contract.js');
            const { PAYLINK_ABI } = await import('../constants/abi.js');
            const hash = await walletClient.writeContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'createGlobalPaymentLink',
                args: [linkID],
            });
            return hash;
        }
        catch (error) {
            console.error('Error creating global payment link on chain:', error.message);
            throw new Error(`Failed to create global payment link on chain: ${error.message}`);
        }
    }
    static async createGlobalPaymentLink(userId, linkID) {
        const paymentLink = await PaymentLink.create({
            linkId: linkID,
            userId,
            amount: 0,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return paymentLink;
    }
    static async contributeToGlobalPaymentLinkOnChain(privateKey, linkID, amount) {
        try {
            const walletClient = createWalletClientFromPrivateKey(privateKey);
            if (!walletClient.account) {
                throw new Error('No account found in wallet client');
            }
            const { parseEther } = await import('viem');
            const { PAYLINK_CONTRACT_ADDRESS } = await import('../constants/contract.js');
            const { PAYLINK_ABI } = await import('../constants/abi.js');
            const amountInWei = parseEther(amount);
            const hash = await walletClient.writeContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'contributeToGlobalPaymentLink',
                args: [linkID],
                value: amountInWei,
            });
            return hash;
        }
        catch (error) {
            console.error('Error contributing to global payment link on chain:', error.message);
            throw new Error(`Failed to contribute to global payment link on chain: ${error.message}`);
        }
    }
}
//# sourceMappingURL=paymentlinks.js.map