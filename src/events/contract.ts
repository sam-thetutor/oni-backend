import { ethers } from 'ethers';
import { PAYLINK_ABI } from '../constants/abi.js';
import { PAYLINK_CONTRACT_ADDRESS } from '../constants/contract.js';
import { GlobalPaymentLink, FixedPaymentLink, Invoice } from '../types/contract.js';

export const listenToGlobalPaymentLinkCreated = (
    provider: ethers.Provider,
    callback: (link: GlobalPaymentLink) => void
) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('GlobalPaymentLinkCreated', (creator: string, link: string) => {
        callback({ creator, link });
    });
};

export const listenToFixedPaymentLinkCreated = (
    provider: ethers.Provider,
    callback: (link: FixedPaymentLink) => void
) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('FixedPaymentLinkCreated', (creator: string, link: string, amount: bigint, status: number) => {
        callback({ creator, link, amount, status });
    });
};

export const listenToInvoiceCreated = (
    provider: ethers.Provider,
    callback: (invoice: Invoice) => void
) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('InvoiceCreated', (invoiceId: string, productId: string, from: string, amount: bigint, status: number) => {
        callback({ invoiceId, productId, from, amount, status });
    });
};

export const listenToPaymentLinkPaid = (
    provider: ethers.Provider,
    callback: (linkId: string, payer: string, amount: bigint) => void
) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('PaymentLinkPaid', (linkId: string, payer: string, amount: bigint) => {
        callback(linkId, payer, amount);
    });
};

export const listenToInvoicePaid = (
    provider: ethers.Provider,
    callback: (invoiceId: string, payer: string, amount: bigint) => void
) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('InvoicePaid', (invoiceId: string, payer: string, amount: bigint) => {
        callback(invoiceId, payer, amount);
    });
}; 