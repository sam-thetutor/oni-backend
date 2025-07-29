import { ethers } from 'ethers';
import { config } from 'dotenv';
import { PAYLINK_ABI } from '../constants/abi.js';
import { PAYLINK_CONTRACT_ADDRESS } from '../constants/contract.js';
import {
    GlobalPaymentLink,
    FixedPaymentLink,
    Invoice,
    ContractResponse,
    TransactionResponse
} from '../types/contract.js';
import { ContractError, CONTRACT_ERRORS } from '../errors/contract.js';

config();

// Initialize provider
const isProduction = process.env.ENVIRONMENT === 'production';
const RPC_URL = isProduction 
  ? (process.env.RPC_URL || 'https://rpc.crossfi.org')
  : (process.env.RPC_URL_TESTNET || 'https://rpc.testnet.ms');

export const provider = new ethers.JsonRpcProvider(RPC_URL);

// Function to create a wallet from private key
export function createWalletFromPrivateKey(privateKey: string): ethers.Wallet {
    try {
        return new ethers.Wallet(privateKey, provider);
    } catch (error) {
        throw new Error('Invalid private key');
    }
}

// Function to convert XFI amount to wei
export function convertToWei(amount: string): bigint {
    return ethers.parseUnits(amount, 18); // XFI has 18 decimals
}

export const getContract = (signer: ethers.Signer) => {
    return new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, signer);
};

export const createGlobalPaymentLink = async (
    wallet: ethers.Wallet,
    linkID: string
): Promise<ethers.ContractTransactionResponse> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.createGlobalPaymentLink(linkID);
};

export const createFixedPaymentLink = async (
    wallet: ethers.Wallet,
    linkID: string,
    amount: string
): Promise<ethers.ContractTransactionResponse> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.createFixedPaymentLink(linkID, amount);
};

export const contributeToGlobalPaymentLink = async (
    wallet: ethers.Wallet,
    linkID: string,
    amount: string
): Promise<ethers.ContractTransactionResponse> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.contributeToGlobalPaymentLink(linkID, { value: amount });
};

export const payFixedPaymentLink = async (
    wallet: ethers.Wallet,
    linkID: string,
    amount: string
): Promise<ethers.ContractTransactionResponse> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.payFixedPaymentLink(linkID, { value: amount });
};

export const createInvoice = async (
    wallet: ethers.Wallet,
    invoiceId: string,
    amount: string
): Promise<ethers.ContractTransactionResponse> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.createInvoice(invoiceId, amount);
};

export const payInvoice = async (
    wallet: ethers.Wallet,
    invoiceId: string,
    amount: string
): Promise<ethers.ContractTransactionResponse> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, wallet);
    return contract.payInvoice(invoiceId, { value: amount });
};

export const getGlobalPaymentLink = async (
    provider: ethers.Provider,
    linkID: string
): Promise<any> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    return contract.getGlobalPaymentLink(linkID);
};

export const getFixedPaymentLink = async (
    provider: ethers.Provider,
    linkID: string
): Promise<any> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    return contract.getFixedPaymentLink(linkID);
};

export const getInvoice = async (
    provider: ethers.Provider,
    invoiceId: string
): Promise<any> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    return contract.getInvoice(invoiceId);
};

export const checkLinkExists = async (
    provider: ethers.Provider,
    type: 'global' | 'fixed',
    linkId: string
): Promise<boolean> => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    if (type === 'global') {
        return contract.globalPaymentLinks(linkId);
    } else {
        return contract.fixedPaymentLinks(linkId);
    }
}; 