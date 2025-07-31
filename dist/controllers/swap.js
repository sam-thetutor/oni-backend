import { SwapService } from '../services/swap.js';
import { WalletService } from '../services/wallet.js';
export class SwapController {
    static async getSwapQuote(req, res) {
        try {
            const { fromToken, toToken, fromAmount, slippage } = req.body;
            if (!fromToken || !toToken || !fromAmount) {
                res.status(400).json({
                    error: 'Missing required fields: fromToken, toToken, fromAmount'
                });
                return;
            }
            const amount = parseFloat(fromAmount);
            if (isNaN(amount) || amount <= 0) {
                res.status(400).json({
                    error: 'Invalid amount. Must be a positive number'
                });
                return;
            }
            const swapParams = {
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
        }
        catch (error) {
            console.error('Error getting swap quote:', error);
            res.status(500).json({
                error: 'Failed to get swap quote',
                message: error.message
            });
        }
    }
    static async executeSwap(req, res) {
        try {
            const { fromToken, toToken, fromAmount, slippage, recipient } = req.body;
            const frontendWalletAddress = req.user?.frontendWalletAddress;
            if (!frontendWalletAddress) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            if (!fromToken || !toToken || !fromAmount) {
                res.status(400).json({
                    error: 'Missing required fields: fromToken, toToken, fromAmount'
                });
                return;
            }
            const amount = parseFloat(fromAmount);
            if (isNaN(amount) || amount <= 0) {
                res.status(400).json({
                    error: 'Invalid amount. Must be a positive number'
                });
                return;
            }
            const user = await WalletService.getUserWallet('', frontendWalletAddress);
            if (!user) {
                res.status(404).json({ error: 'User wallet not found' });
                return;
            }
            const swapParams = {
                fromToken,
                toToken,
                fromAmount: fromAmount.toString(),
                slippage,
                recipient: recipient,
            };
            const result = await SwapService.executeSwap(user, swapParams);
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Swap executed successfully',
                    data: result,
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error,
                    errorCode: result.errorCode,
                    data: result,
                });
            }
        }
        catch (error) {
            console.error('Error executing swap:', error);
            res.status(500).json({
                error: 'Failed to execute swap',
                message: error.message
            });
        }
    }
    static async validateSwap(req, res) {
        try {
            const { fromToken, toToken, fromAmount, slippage } = req.body;
            const frontendWalletAddress = req.user?.frontendWalletAddress;
            if (!frontendWalletAddress) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            if (!fromToken || !toToken || !fromAmount) {
                res.status(400).json({
                    error: 'Missing required fields: fromToken, toToken, fromAmount'
                });
                return;
            }
            const user = await WalletService.getUserWallet('', frontendWalletAddress);
            if (!user) {
                res.status(404).json({ error: 'User wallet not found' });
                return;
            }
            const swapParams = {
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
        }
        catch (error) {
            console.error('Error validating swap:', error);
            res.status(500).json({
                error: 'Failed to validate swap',
                message: error.message
            });
        }
    }
    static async getSupportedPairs(req, res) {
        try {
            const pairs = SwapService.getSupportedPairs();
            res.json({
                success: true,
                data: pairs,
            });
        }
        catch (error) {
            console.error('Error getting supported pairs:', error);
            res.status(500).json({
                error: 'Failed to get supported pairs',
                message: error.message
            });
        }
    }
    static async getSwapConfig(req, res) {
        try {
            const config = SwapService.getSwapConfig();
            res.json({
                success: true,
                data: config,
            });
        }
        catch (error) {
            console.error('Error getting swap config:', error);
            res.status(500).json({
                error: 'Failed to get swap config',
                message: error.message
            });
        }
    }
}
//# sourceMappingURL=swap.js.map