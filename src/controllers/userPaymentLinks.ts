import { Request, Response } from 'express';
import { config } from 'dotenv';
import { PaymentLink } from '../models/PaymentLink.js';
import { ContractReadService } from '../services/contractread.js';
import { z } from 'zod';
import mongoose from 'mongoose';

// Load environment variables
config();

// Validation schemas
const getPaginationSchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val) : 1),
  limit: z.string().optional().transform((val) => val ? parseInt(val) : 10),
  type: z.enum(['fixed', 'global', 'all']).optional().default('all')
});

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
    email?: string;
    dbUser?: any;
  };
}

export class UserPaymentLinksController {
  
  /**
   * Get all payment links for the authenticated user
   * GET /api/user/payment-links
   */
  async getUserPaymentLinks(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { page, limit, type } = getPaginationSchema.parse(req.query);
      const offset = (page - 1) * limit;



      // Build query filter
      let filter: any = { userId: user.id };
      
      // If type is specified and not 'all', filter by amount (global links have amount: 0)
      if (type === 'fixed') {
        filter.amount = { $gt: 0 };
      } else if (type === 'global') {
        filter.amount = 0;
      }

      // Get total count for pagination
      const total = await PaymentLink.countDocuments(filter);

      // Get payment links with pagination
      const paymentLinks = await PaymentLink.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      console.log(`Found ${paymentLinks.length} payment links out of ${total} total`);

      // Enhance payment links with blockchain status
      const contractReadService = new ContractReadService();
      const enhancedPaymentLinks = await Promise.all(
        paymentLinks.map(async (link) => {
          let blockchainStatus = null;
          let onChainData = null;

          try {
            // Determine link type and get blockchain status
            const isGlobal = link.amount === 0;
            
            if (isGlobal) {
              const result = await contractReadService.checkGlobalPaymentLinkStatus(link.linkId);
              if (result.success) {
                blockchainStatus = 'active';
                onChainData = result.data;
              }
            } else {
              const result = await contractReadService.checkPaymentLinkStatus(link.linkId);
              if (result.success) {
                blockchainStatus = result.data.status;
                onChainData = result.data;
              }
            }
          } catch (error) {
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
        })
      );

      // Calculate pagination metadata
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

    } catch (error: any) {
      console.error('Error fetching user payment links:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch payment links',
        details: error.message 
      });
    }
  }

  /**
   * Get specific payment link details for the authenticated user
   * GET /api/user/payment-links/:linkId
   */
  async getUserPaymentLink(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { linkId } = req.params;
      if (!linkId) {
        return res.status(400).json({ error: 'Link ID is required' });
      }



      // Find the payment link
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

      // Get blockchain status
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
        } else {
          const result = await contractReadService.checkPaymentLinkStatus(linkId);
          if (result.success) {
            blockchainStatus = result.data.status;
            onChainData = result.data;
          }
        }
      } catch (error) {
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

    } catch (error: any) {
      console.error('Error fetching payment link:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch payment link',
        details: error.message 
      });
    }
  }

  /**
   * Get payment link statistics for the authenticated user
   * GET /api/user/payment-links/stats
   */
  async getUserPaymentLinkStats(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Check if PaymentLink model is available
      if (!PaymentLink) {
        console.error('PaymentLink model is not available');
        return res.status(500).json({ 
          success: false,
          error: 'Database model not available' 
        });
      }

      // Check if database is connected
      if (mongoose.connection.readyState !== 1) {
        console.error('Database not connected, readyState:', mongoose.connection.readyState);
        return res.status(500).json({ 
          success: false,
          error: 'Database not connected' 
        });
      }

      // Get all user payment links
      const paymentLinks = await PaymentLink.find({ userId: user.id }).lean();

      // Separate fixed and global links
      const fixedLinks = paymentLinks.filter(link => link.amount > 0);
      const globalLinks = paymentLinks.filter(link => link.amount === 0);

      // Calculate basic stats
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

      // Try to get blockchain data for enhanced stats
      const contractReadService = new ContractReadService();
      let totalOnChainContributions = 0;

      for (const link of globalLinks) {
        try {
          const result = await contractReadService.checkGlobalPaymentLinkStatus(link.linkId);
          if (result.success && result.data) {
            totalOnChainContributions += result.data.totalContributionsInXFI;
          }
        } catch (error) {
          console.error(`Error fetching blockchain data for global link ${link.linkId}:`, error);
        }
      }

      // Add blockchain-enhanced stats
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

    } catch (error: any) {
      console.error('Error fetching payment link stats:', error);
      
      // Check if it's a database connection error
      if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
        return res.status(503).json({ 
          success: false,
          error: 'Database connection error',
          details: 'Unable to connect to database'
        });
      }
      
      // Check if it's a validation error
      if (error.name === 'ValidationError') {
        return res.status(400).json({ 
          success: false,
          error: 'Validation error',
          details: error.message 
        });
      }
      
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch payment link statistics',
        details: error.message 
      });
    }
  }

  /**
   * Delete a payment link (soft delete - mark as cancelled)
   * DELETE /api/user/payment-links/:linkId
   */
  async deleteUserPaymentLink(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { linkId } = req.params;
      if (!linkId) {
        return res.status(400).json({ error: 'Link ID is required' });
      }



      // Find and update the payment link
      const paymentLink = await PaymentLink.findOneAndUpdate(
        { 
          linkId: linkId,
          userId: user.id 
        },
        { 
          status: 'cancelled',
          updatedAt: new Date()
        },
        { new: true }
      );

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

    } catch (error: any) {
      console.error('Error deleting payment link:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete payment link',
        details: error.message 
      });
    }
  }

  /**
   * Get specific payment link details (public access)
   * GET /api/user/payment-links/public/:linkId
   */
  async getPublicPaymentLink(req: Request, res: Response) {
    try {
      const { linkId } = req.params;
      if (!linkId) {
        return res.status(400).json({ error: 'Link ID is required' });
      }

      // Find the payment link (no user restriction for public access)
      const paymentLink = await PaymentLink.findOne({ 
        linkId: linkId
      }).lean();

      if (!paymentLink) {
        return res.status(404).json({ 
          success: false,
          error: 'Payment link not found' 
        });
      }

      // Get blockchain status
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
        } else {
          const result = await contractReadService.checkPaymentLinkStatus(linkId);
          if (result.success) {
            blockchainStatus = result.data.status;
            onChainData = result.data;
          }
        }
      } catch (error) {
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

    } catch (error: any) {
      console.error('Error fetching public payment link:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch payment link',
        details: error.message 
      });
    }
  }
} 