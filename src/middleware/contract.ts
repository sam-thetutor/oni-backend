import { Request, Response, NextFunction } from 'express';
import { decryptForTransaction } from '../utils/session.js';

export const validatePrivateKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { encryptedPrivateKey, iv, sessionKey } = req.body;

        if (!encryptedPrivateKey || !iv || !sessionKey) {
            return res.status(400).json({ error: 'Missing required authentication parameters' });
        }

        const decryptedPrivateKey = await decryptForTransaction(encryptedPrivateKey, iv, sessionKey);
        req.body.privateKey = decryptedPrivateKey;
        next();
    } catch (error) {
        console.error('Error validating private key:', error);
        return res.status(401).json({ error: 'Invalid authentication parameters' });
    }
};

export const validateAmount = (req: Request, res: Response, next: NextFunction) => {
    try {
        const { amount } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        // Convert amount to number and check if it's valid
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        next();
    } catch (error) {
        console.error('Error validating amount:', error);
        return res.status(400).json({ error: 'Invalid amount format' });
    }
};

export const validateLinkId = (req: Request, res: Response, next: NextFunction) => {
    try {
        const { linkID } = req.body;

        if (!linkID) {
            return res.status(400).json({ error: 'Link ID is required' });
        }

        if (typeof linkID !== 'string' || linkID.trim().length === 0) {
            return res.status(400).json({ error: 'Invalid Link ID' });
        }

        next();
    } catch (error) {
        console.error('Error validating link ID:', error);
        return res.status(400).json({ error: 'Invalid Link ID format' });
    }
};

export const validateInvoiceId = (req: Request, res: Response, next: NextFunction) => {
    try {
        const { invoiceId } = req.body;

        if (!invoiceId) {
            return res.status(400).json({ error: 'Invoice ID is required' });
        }

        if (typeof invoiceId !== 'string' || invoiceId.trim().length === 0) {
            return res.status(400).json({ error: 'Invalid Invoice ID' });
        }

        next();
    } catch (error) {
        console.error('Error validating invoice ID:', error);
        return res.status(400).json({ error: 'Invalid Invoice ID format' });
    }
}; 