import { ethers } from 'ethers';
import { config } from 'dotenv';
import { PAYLINK_ABI } from '../constants/abi.js';
import { PAYLINK_CONTRACT_ADDRESS } from '../constants/contract.js';
config();
export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc.testnet.ms');
export function createWalletFromPrivateKey(privateKey) {
    try {
        return new ethers.Wallet(privateKey, provider);
    }
    catch (error) {
        throw new Error('Invalid private key');
    }
}
export function convertToWei(amount) {
    return ethers.parseUnits(amount, 18);
}
export const getContract = (signer) => {
    return new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, signer);
};
export const createGlobalPaymentLink = async (wallet, linkID) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.createGlobalPaymentLink(linkID);
};
export const createFixedPaymentLink = async (wallet, linkID, amount) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.createFixedPaymentLink(linkID, amount);
};
export const contributeToGlobalPaymentLink = async (wallet, linkID, amount) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.contributeToGlobalPaymentLink(linkID, { value: amount });
};
export const payFixedPaymentLink = async (wallet, linkID, amount) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.payFixedPaymentLink(linkID, { value: amount });
};
export const createInvoice = async (wallet, invoiceId, amount) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.createInvoice(invoiceId, amount);
};
export const payInvoice = async (wallet, invoiceId, amount) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.payInvoice(invoiceId, { value: amount });
};
export const getGlobalPaymentLink = async (provider, linkID) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    return contract.getGlobalPaymentLink(linkID);
};
export const getFixedPaymentLink = async (provider, linkID) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    return contract.getFixedPaymentLink(linkID);
};
export const getInvoice = async (provider, invoiceId) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    return contract.getInvoice(invoiceId);
};
export const checkLinkExists = async (provider, type, linkId) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    if (type === 'global') {
        return contract.globalPaymentLinks(linkId);
    }
    else {
        return contract.fixedPaymentLinks(linkId);
    }
};
//# sourceMappingURL=contract.js.map