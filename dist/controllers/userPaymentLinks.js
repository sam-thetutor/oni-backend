import { PaymentLink } from '../models/PaymentLink.js';
import { ContractReadService } from '../services/contractread.js';
import { z } from 'zod';
const getPaginationSchema = z.object({
    page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
    limit: z.string().optional().transform((val) => val ? parseInt(val) : 10),
    type: z.enum(['fixed', 'global', 'all']).optional().default('all')
});
export class UserPaymentLinksController {
    async getUserPaymentLinks(req, res) {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const { page, limit, type } = getPaginationSchema.parse(req.query);
            const offset = (page - 1) * limit;
            console.log(`Fetching payment links for user ${user.id}, page: ${page}, limit: ${limit}, type: ${type}`);
            let filter = { userId: user.id };
            if (type === 'fixed') {
                filter.amount = { $gt: 0 };
            }
            else if (type === 'global') {
                filter.amount = 0;
            }
            const total = await PaymentLink.countDocuments(filter);
            const paymentLinks = await PaymentLink.find(filter)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean();
            console.log(`Found ${paymentLinks.length} payment links out of ${total} total`);
            const contractReadService = new ContractReadService();
            const enhancedPaymentLinks = await Promise.all(paymentLinks.map(async (link) => {
                let blockchainStatus = null;
                let onChainData = null;
                try {
                    const isGlobal = link.amount === 0;
                    if (isGlobal) {
                        const result = await contractReadService.checkGlobalPaymentLinkStatus(link.linkId);
                        if (result.success) {
                            blockchainStatus = 'active';
                            onChainData = result.data;
                        }
                    }
                    else {
                        const result = await contractReadService.checkPaymentLinkStatus(link.linkId);
                        if (result.success) {
                            blockchainStatus = result.data.status;
                            onChainData = result.data;
                        }
                    }
                }
                catch (error) {
                    console.error(`Error fetching blockchain status for link ${link.linkId}:`, error);
                    blockchainStatus = 'unknown';
                }
                return {
                    ...link,
                    type: link.amount === 0 ? 'global' : 'fixed',
                    blockchainStatus,
                    onChainData,
                    paymentUrl: link.amount === 0
                        ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/global-paylink/${link.linkId}`
                        : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paylink/${link.linkId}`,
                    shareableUrl: link.amount === 0
                        ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/global-paylink/${link.linkId}`
                        : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paylink/${link.linkId}`
                };
            }));
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;
            res.json({
                success: true,
                data: {
                    paymentLinks: enhancedPaymentLinks,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages,
                        hasNextPage,
                        hasPrevPage
                    },
                    summary: {
                        totalLinks: total,
                        fixedLinks: enhancedPaymentLinks.filter(link => link.type === 'fixed').length,
                        globalLinks: enhancedPaymentLinks.filter(link => link.type === 'global').length
                    }
                }
            });
        }
        catch (error) {
            console.error('Error fetching user payment links:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch payment links',
                details: error.message
            });
        }
    }
    async getUserPaymentLink(req, res) {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const { linkId } = req.params;
            if (!linkId) {
                return res.status(400).json({ error: 'Link ID is required' });
            }
            console.log(`Fetching payment link ${linkId} for user ${user.id}`);
            const paymentLink = await PaymentLink.findOne({
                linkId: linkId,
                userId: user.id
            }).lean();
            if (!paymentLink) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment link not found'
                });
            }
            const contractReadService = new ContractReadService();
            let blockchainStatus = null;
            let onChainData = null;
            try {
                const isGlobal = paymentLink.amount === 0;
                if (isGlobal) {
                    const result = await contractReadService.checkGlobalPaymentLinkStatus(linkId);
                    if (result.success) {
                        blockchainStatus = 'active';
                        onChainData = result.data;
                    }
                }
                else {
                    const result = await contractReadService.checkPaymentLinkStatus(linkId);
                    if (result.success) {
                        blockchainStatus = result.data.status;
                        onChainData = result.data;
                    }
                }
            }
            catch (error) {
                console.error(`Error fetching blockchain status for link ${linkId}:`, error);
                blockchainStatus = 'unknown';
            }
            const enhancedPaymentLink = {
                ...paymentLink,
                type: paymentLink.amount === 0 ? 'global' : 'fixed',
                blockchainStatus,
                onChainData,
                paymentUrl: paymentLink.amount === 0
                    ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/global-paylink/${linkId}`
                    : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paylink/${linkId}`,
                shareableUrl: paymentLink.amount === 0
                    ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/global-paylink/${linkId}`
                    : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/paylink/${linkId}`
            };
            res.json({
                success: true,
                data: enhancedPaymentLink
            });
        }
        catch (error) {
            console.error('Error fetching payment link:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch payment link',
                details: error.message
            });
        }
    }
    async getUserPaymentLinkStats(req, res) {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            console.log(`Fetching payment link stats for user ${user.id}`);
            const paymentLinks = await PaymentLink.find({ userId: user.id }).lean();
            const fixedLinks = paymentLinks.filter(link => link.amount > 0);
            const globalLinks = paymentLinks.filter(link => link.amount === 0);
            const stats = {
                totalLinks: paymentLinks.length,
                fixedLinks: {
                    count: fixedLinks.length,
                    totalAmount: fixedLinks.reduce((sum, link) => sum + link.amount, 0),
                    activeCount: fixedLinks.filter(link => link.status === 'active').length,
                    paidCount: fixedLinks.filter(link => link.status === 'paid').length
                },
                globalLinks: {
                    count: globalLinks.length,
                    activeCount: globalLinks.filter(link => link.status === 'active').length
                },
                recentLinks: paymentLinks
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 5)
                    .map(link => ({
                    linkId: link.linkId,
                    type: link.amount === 0 ? 'global' : 'fixed',
                    amount: link.amount,
                    status: link.status,
                    createdAt: link.createdAt
                }))
            };
            const contractReadService = new ContractReadService();
            let totalOnChainContributions = 0;
            for (const link of globalLinks) {
                try {
                    const result = await contractReadService.checkGlobalPaymentLinkStatus(link.linkId);
                    if (result.success && result.data) {
                        totalOnChainContributions += result.data.totalContributionsInXFI;
                    }
                }
                catch (error) {
                    console.error(`Error fetching blockchain data for global link ${link.linkId}:`, error);
                }
            }
            const enhancedStats = {
                ...stats,
                globalLinks: {
                    ...stats.globalLinks,
                    totalContributions: totalOnChainContributions
                }
            };
            res.json({
                success: true,
                data: enhancedStats
            });
        }
        catch (error) {
            console.error('Error fetching payment link stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch payment link statistics',
                details: error.message
            });
        }
    }
    async deleteUserPaymentLink(req, res) {
        try {
            const user = req.user;
            if (!user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }
            const { linkId } = req.params;
            if (!linkId) {
                return res.status(400).json({ error: 'Link ID is required' });
            }
            console.log(`Deleting payment link ${linkId} for user ${user.id}`);
            const paymentLink = await PaymentLink.findOneAndUpdate({
                linkId: linkId,
                userId: user.id
            }, {
                status: 'cancelled',
                updatedAt: new Date()
            }, { new: true });
            if (!paymentLink) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment link not found'
                });
            }
            res.json({
                success: true,
                message: 'Payment link cancelled successfully',
                data: {
                    linkId: paymentLink.linkId,
                    status: paymentLink.status
                }
            });
        }
        catch (error) {
            console.error('Error deleting payment link:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete payment link',
                details: error.message
            });
        }
    }
}
//# sourceMappingURL=userPaymentLinks.js.map