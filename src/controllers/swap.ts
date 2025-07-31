import { Request, Response } from 'express';
import { SwapService } from '../services/swap.js';
import { SwapParams } from '../types/swap.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { WalletService } from '../services/wallet.js';

export class SwapController {
  /**
   * Get swap quote
   * POST /api/swap/quote
   */
  static async getSwapQuote(req: Request, res: Response): Promise<void> {
    try {
      const { fromToken, toToken, fromAmount, slippage } = req.body;

      // Validate required fields
      if (!fromToken || !toToken || !fromAmount) {
        res.status(400).json({ 
          error: 'Missing required fields: fromToken, toToken, fromAmount' 
        });
        return;
      }

      // Validate amount
      const amount = parseFloat(fromAmount);
      if (isNaN(amount) || amount <= 0) {
        res.status(400).json({ 
          error: 'Invalid amount. Must be a positive number' 
        });
        return;
      }

      const swapParams: SwapParams = {
        fromToken,
        toToken,
        fromAmount: fromAmount.toString(),
        slippage,
      };

      const quote = await SwapService.getSwapQuote(swapParams);

      res.json({
        success: true,
        data: quote,
      });
    } catch (error: any) {
      console.error('Error getting swap quote:', error);
      res.status(500).json({ 
        error: 'Failed to get swap quote',
        message: error.message 
      });
    }
  }

  /**
   * Execute swap
   * POST /api/swap/execute
   */
  static async executeSwap(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { fromToken, toToken, fromAmount, slippage, recipient } = req.body;
      const frontendWalletAddress = req.user?.frontendWalletAddress;

      if (!frontendWalletAddress) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Validate required fields
      if (!fromToken || !toToken || !fromAmount) {
        res.status(400).json({ 
          error: 'Missing required fields: fromToken, toToken, fromAmount' 
        });
        return;
      }

      // Validate amount
      const amount = parseFloat(fromAmount);
      if (isNaN(amount) || amount <= 0) {
        res.status(400).json({ 
          error: 'Invalid amount. Must be a positive number' 
        });
        return;
      }

      // Get user wallet
      const user = await WalletService.getUserWallet('', frontendWalletAddress);
      if (!user) {
        res.status(404).json({ error: 'User wallet not found' });
        return;
      }

      const swapParams: SwapParams = {
        fromToken,
        toToken,
        fromAmount: fromAmount.toString(),
        slippage,
        recipient: recipient as any,
      };

      const result = await SwapService.executeSwap(user, swapParams);

      if (result.success) {
        res.json({
          success: true,
          message: 'Swap executed successfully',
          data: result,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          data: result,
        });
      }
    } catch (error: any) {
      console.error('Error executing swap:', error);
      res.status(500).json({ 
        error: 'Failed to execute swap',
        message: error.message 
      });
    }
  }

  /**
   * Validate swap parameters
   * POST /api/swap/validate
   */
  static async validateSwap(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { fromToken, toToken, fromAmount, slippage } = req.body;
      const frontendWalletAddress = req.user?.frontendWalletAddress;

      if (!frontendWalletAddress) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Validate required fields
      if (!fromToken || !toToken || !fromAmount) {
        res.status(400).json({ 
          error: 'Missing required fields: fromToken, toToken, fromAmount' 
        });
        return;
      }

      // Get user wallet
      const user = await WalletService.getUserWallet('', frontendWalletAddress);
      if (!user) {
        res.status(404).json({ error: 'User wallet not found' });
        return;
      }

      const swapParams: SwapParams = {
        fromToken,
        toToken,
        fromAmount: fromAmount.toString(),
        slippage,
      };

      const validation = await SwapService.validateSwap(user, swapParams);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error: any) {
      console.error('Error validating swap:', error);
      res.status(500).json({ 
        error: 'Failed to validate swap',
        message: error.message 
      });
    }
  }

  /**
   * Get supported token pairs
   * GET /api/swap/pairs
   */
  static async getSupportedPairs(req: Request, res: Response): Promise<void> {
    try {
      const pairs = SwapService.getSupportedPairs();

      res.json({
        success: true,
        data: pairs,
      });
    } catch (error: any) {
      console.error('Error getting supported pairs:', error);
      res.status(500).json({ 
        error: 'Failed to get supported pairs',
        message: error.message 
      });
    }
  }

  /**
   * Get swap configuration
   * GET /api/swap/config
   */
  static async getSwapConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = SwapService.getSwapConfig();

      res.json({
        success: true,
        data: config,
      });
    } catch (error: any) {
      console.error('Error getting swap config:', error);
      res.status(500).json({ 
        error: 'Failed to get swap config',
        message: error.message 
      });
    }
  }
} 