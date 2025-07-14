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
            console.log('Creating payment link on chain:', { linkID, amount });
            const walletClient = createWalletClientFromPrivateKey(privateKey);
            if (!walletClient.account) {
                throw new Error('No account found in wallet client');
            }
            console.log('Wallet client created for address:', walletClient.account.address);
            const { parseEther } = await import('viem');
            const { PAYLINK_CONTRACT_ADDRESS } = await import('../constants/contract.js');
            const { PAYLINK_ABI } = await import('../constants/abi.js');
            const amountInWei = parseEther(amount);
            console.log('Amount converted to Wei:', amountInWei.toString());
            console.log('Calling contract at:', PAYLINK_CONTRACT_ADDRESS);
            console.log('With args:', [linkID, amountInWei]);
            const hash = await walletClient.writeContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'createFixedPaymentLink',
                args: [linkID, amountInWei],
            });
            console.log('Payment link created on chain:', hash);
            return hash;
        }
        catch (error) {
            console.error('Error creating payment link on chain:', error.message);
            throw new Error(`Failed to create payment link on chain: ${error.message}`);
        }
    }
    static async createGlobalPaymentLinkOnChain(privateKey, linkID) {
        try {
            console.log('Creating global payment link on chain:', { linkID });
            const walletClient = createWalletClientFromPrivateKey(privateKey);
            if (!walletClient.account) {
                throw new Error('No account found in wallet client');
            }
            console.log('Wallet client created for address:', walletClient.account.address);
            const { PAYLINK_CONTRACT_ADDRESS } = await import('../constants/contract.js');
            const { PAYLINK_ABI } = await import('../constants/abi.js');
            console.log('Calling contract at:', PAYLINK_CONTRACT_ADDRESS);
            console.log('With args:', [linkID]);
            const hash = await walletClient.writeContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'createGlobalPaymentLink',
                args: [linkID],
            });
            console.log('Global payment link created on chain:', hash);
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
            console.log('Contributing to global payment link on chain:', { linkID, amount });
            const walletClient = createWalletClientFromPrivateKey(privateKey);
            if (!walletClient.account) {
                throw new Error('No account found in wallet client');
            }
            console.log('Wallet client created for address:', walletClient.account.address);
            const { parseEther } = await import('viem');
            const { PAYLINK_CONTRACT_ADDRESS } = await import('../constants/contract.js');
            const { PAYLINK_ABI } = await import('../constants/abi.js');
            const amountInWei = parseEther(amount);
            console.log('Amount converted to Wei:', amountInWei.toString());
            console.log('Calling contract at:', PAYLINK_CONTRACT_ADDRESS);
            console.log('With args:', [linkID]);
            console.log('With value:', amountInWei.toString());
            const hash = await walletClient.writeContract({
                address: PAYLINK_CONTRACT_ADDRESS,
                abi: PAYLINK_ABI,
                functionName: 'contributeToGlobalPaymentLink',
                args: [linkID],
                value: amountInWei,
            });
            console.log('Contribution to global payment link successful:', hash);
            return hash;
        }
        catch (error) {
            console.error('Error contributing to global payment link on chain:', error.message);
            throw new Error(`Failed to contribute to global payment link on chain: ${error.message}`);
        }
    }
}
//# sourceMappingURL=paymentlinks.js.map