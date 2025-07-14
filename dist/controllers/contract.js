import { ContractService } from '../services/contract.js';
import { ContractReadService } from '../services/contractread.js';
import { z } from 'zod';
const createGlobalPaymentLinkSchema = z.object({
    linkID: z.string().min(1)
});
const createFixedPaymentLinkSchema = z.object({
    linkID: z.string().min(1),
    amount: z.string().min(1)
});
const contributeToGlobalPaymentLinkSchema = z.object({
    linkID: z.string().min(1),
    amount: z.string().min(1)
});
const payFixedPaymentLinkSchema = z.object({
    linkID: z.string().min(1),
    amount: z.string().min(1)
});
const createInvoiceSchema = z.object({
    invoiceId: z.string().min(1),
    amount: z.string().min(1)
});
const payInvoiceSchema = z.object({
    invoiceId: z.string().min(1),
    amount: z.string().min(1)
});
const invoiceIdSchema = z.object({
    invoiceId: z.string().min(1)
});
export class ContractController {
    getContractService(req) {
        const privateKey = req.body.privateKey;
        if (!privateKey) {
            throw new Error('Private key is required for this operation');
        }
        return new ContractService(privateKey);
    }
    async createGlobalPaymentLink(req, res) {
        try {
            const { linkID } = createGlobalPaymentLinkSchema.parse(req.body);
            const contractService = this.getContractService(req);
            const result = await contractService.createGlobalPaymentLink(linkID);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async createFixedPaymentLink(req, res) {
        try {
            const { linkID, amount } = createFixedPaymentLinkSchema.parse(req.body);
            const contractService = this.getContractService(req);
            const result = await contractService.createFixedPaymentLink(linkID, amount);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async contributeToGlobalPaymentLink(req, res) {
        try {
            const { linkID, amount } = contributeToGlobalPaymentLinkSchema.parse(req.body);
            const contractService = this.getContractService(req);
            const result = await contractService.contributeToGlobalPaymentLink(linkID, amount);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async payFixedPaymentLink(req, res) {
        try {
            const { linkID, amount } = payFixedPaymentLinkSchema.parse(req.body);
            const contractService = this.getContractService(req);
            const result = await contractService.payFixedPaymentLink(linkID, amount);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async createInvoice(req, res) {
        try {
            const { invoiceId, amount } = createInvoiceSchema.parse(req.body);
            const contractService = this.getContractService(req);
            const result = await contractService.createInvoice(invoiceId, amount);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async payInvoice(req, res) {
        try {
            const { invoiceId, amount } = payInvoiceSchema.parse(req.body);
            const contractService = this.getContractService(req);
            const result = await contractService.payInvoice(invoiceId, amount);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async getGlobalPaymentLink(req, res) {
        try {
            const { linkID } = createGlobalPaymentLinkSchema.parse(req.params);
            const contractService = this.getContractService(req);
            const result = await contractService.getGlobalPaymentLink(linkID);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async getFixedPaymentLink(req, res) {
        try {
            const { linkID } = createGlobalPaymentLinkSchema.parse(req.params);
            const contractService = this.getContractService(req);
            const result = await contractService.getFixedPaymentLink(linkID);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async getInvoice(req, res) {
        try {
            const { invoiceId } = invoiceIdSchema.parse(req.params);
            const contractService = this.getContractService(req);
            const result = await contractService.getInvoice(invoiceId);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async checkLinkExists(req, res) {
        try {
            const { type, linkId } = req.params;
            if (type !== 'global' && type !== 'fixed') {
                throw new Error('Invalid link type. Must be either "global" or "fixed"');
            }
            const contractService = this.getContractService(req);
            const result = await contractService.checkLinkExists(type, linkId);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async checkPaymentLinkStatus(req, res) {
        try {
            const { linkId } = req.params;
            if (!linkId) {
                return res.status(400).json({ error: 'Link ID is required' });
            }
            const contractReadService = new ContractReadService();
            const result = await contractReadService.checkPaymentLinkStatus(linkId);
            if (result.success) {
                res.json({
                    success: true,
                    data: result.data,
                    message: 'Payment link status retrieved from blockchain'
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    error: result.error
                });
            }
        }
        catch (error) {
            console.error('Error checking payment link status:', error);
            res.status(500).json({ error: error.message });
        }
    }
    async checkGlobalPaymentLinkStatus(req, res) {
        try {
            const { linkId } = req.params;
            if (!linkId) {
                return res.status(400).json({ error: 'Link ID is required' });
            }
            const contractReadService = new ContractReadService();
            const result = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
            if (result.success) {
                res.json({
                    success: true,
                    data: result.data,
                    message: 'Global payment link status retrieved from blockchain'
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    error: result.error
                });
            }
        }
        catch (error) {
            console.error('Error checking global payment link status:', error);
            res.status(500).json({ error: error.message });
        }
    }
    async payGlobalPaymentLink(req, res) {
        try {
            const { linkID, amount } = contributeToGlobalPaymentLinkSchema.parse(req.body);
            const contractService = this.getContractService(req);
            const result = await contractService.contributeToGlobalPaymentLink(linkID, amount);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
//# sourceMappingURL=contract.js.map