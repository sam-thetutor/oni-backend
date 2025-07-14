import { ethers } from 'ethers';
import { config } from 'dotenv';
import {
    createGlobalPaymentLink,
    createFixedPaymentLink,
    contributeToGlobalPaymentLink,
    payFixedPaymentLink,
    createInvoice,
    payInvoice,
    getGlobalPaymentLink,
    getFixedPaymentLink,
    getInvoice,
    checkLinkExists
} from '../utils/contract.js';
import { ContractError, CONTRACT_ERRORS, handleContractError } from '../errors/contract.js';

config();

export class ContractService {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;

    constructor(privateKey: string) {
        this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
    }

    async createGlobalPaymentLink(linkID: string): Promise<any> {
        try {
            const tx = await createGlobalPaymentLink(this.wallet, linkID);
            const receipt = await tx.wait();
            return {
                success: true,
                data: {
                    linkID,
                    transactionHash: receipt?.hash
                }
            };
        } catch (error) {
            return handleContractError(error);
        }
    }

    async createFixedPaymentLink(linkID: string, amount: string): Promise<any> {
        try {
            const tx = await createFixedPaymentLink(this.wallet, linkID, amount);
            const receipt = await tx.wait();
            return {
                success: true,
                data: {
                    linkID,
                    amount,
                    transactionHash: receipt?.hash
                }
            };
        } catch (error) {
            return handleContractError(error);
        }
    }

    async contributeToGlobalPaymentLink(linkID: string, amount: string): Promise<any> {
        try {
            const tx = await contributeToGlobalPaymentLink(this.wallet, linkID, amount);
            const receipt = await tx.wait();
            return {
                success: true,
                data: {
                    linkID,
                    amount,
                    transactionHash: receipt?.hash
                }
            };
        } catch (error) {
            return handleContractError(error);
        }
    }

    async payFixedPaymentLink(linkID: string, amount: string): Promise<any> {
        try {
            const tx = await payFixedPaymentLink(this.wallet, linkID, amount);
            const receipt = await tx.wait();
            return {
                success: true,
                data: {
                    linkID,
                    amount,
                    transactionHash: receipt?.hash
                }
            };
        } catch (error) {
            return handleContractError(error);
        }
    }

    async createInvoice(invoiceId: string, amount: string): Promise<any> {
        try {
            const tx = await createInvoice(this.wallet, invoiceId, amount);
            const receipt = await tx.wait();
            return {
                success: true,
                data: {
                    invoiceId,
                    amount,
                    transactionHash: receipt?.hash
                }
            };
        } catch (error) {
            return handleContractError(error);
        }
    }

    async payInvoice(invoiceId: string, amount: string): Promise<any> {
        try {
            const tx = await payInvoice(this.wallet, invoiceId, amount);
            const receipt = await tx.wait();
            return {
                success: true,
                data: {
                    invoiceId,
                    amount,
                    transactionHash: receipt?.hash
                }
            };
        } catch (error) {
            return handleContractError(error);
        }
    }

    async getGlobalPaymentLink(linkID: string): Promise<any> {
        try {
            const link = await getGlobalPaymentLink(this.provider, linkID);
            if (!link) {
                throw new ContractError('Global payment link not found', CONTRACT_ERRORS.LINK_NOT_FOUND);
            }
            return {
                success: true,
                data: link
            };
        } catch (error) {
            return handleContractError(error);
        }
    }

    async getFixedPaymentLink(linkID: string): Promise<any> {
        try {
            const link = await getFixedPaymentLink(this.provider, linkID);
            if (!link) {
                throw new ContractError('Fixed payment link not found', CONTRACT_ERRORS.LINK_NOT_FOUND);
            }
            return {
                success: true,
                data: link
            };
        } catch (error) {
            return handleContractError(error);
        }
    }

    async getInvoice(invoiceId: string): Promise<any> {
        try {
            const invoice = await getInvoice(this.provider, invoiceId);
            if (!invoice) {
                throw new ContractError('Invoice not found', CONTRACT_ERRORS.INVOICE_NOT_FOUND);
            }
            return {
                success: true,
                data: invoice
            };
        } catch (error) {
            return handleContractError(error);
        }
    }

    async checkLinkExists(type: 'global' | 'fixed', linkId: string): Promise<any> {
        try {
            const exists = await checkLinkExists(this.provider, type, linkId);
            return {
                success: true,
                data: {
                    exists
                }
            };
        } catch (error) {
            return handleContractError(error);
        }
    }
} 