import { ethers } from 'ethers';
import { PAYLINK_ABI } from '../constants/abi.js';
import { PAYLINK_CONTRACT_ADDRESS } from '../constants/contract.js';
export const listenToGlobalPaymentLinkCreated = (provider, callback) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('GlobalPaymentLinkCreated', (creator, link) => {
        callback({ creator, link });
    });
};
export const listenToFixedPaymentLinkCreated = (provider, callback) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('FixedPaymentLinkCreated', (creator, link, amount, status) => {
        callback({ creator, link, amount, status });
    });
};
export const listenToInvoiceCreated = (provider, callback) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('InvoiceCreated', (invoiceId, productId, from, amount, status) => {
        callback({ invoiceId, productId, from, amount, status });
    });
};
export const listenToPaymentLinkPaid = (provider, callback) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('PaymentLinkPaid', (linkId, payer, amount) => {
        callback(linkId, payer, amount);
    });
};
export const listenToInvoicePaid = (provider, callback) => {
    const contract = new ethers.Contract(PAYLINK_CONTRACT_ADDRESS, PAYLINK_ABI, provider);
    contract.on('InvoicePaid', (invoiceId, payer, amount) => {
        callback(invoiceId, payer, amount);
    });
};
//# sourceMappingURL=contract.js.map