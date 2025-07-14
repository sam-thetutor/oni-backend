import { parseUnits, formatUnits } from 'viem';
import { publicClient, createWalletClientFromPrivateKey } from '../config/viem.js';
import { TokenService } from './tokens.js';
import { PriceAnalyticsService } from './price-analytics.js';
import { TOKEN_ADDRESSES, TOKEN_METADATA } from '../constants/tokens.js';
import { ERC20_ABI } from '../constants/abi.js';
import { SWAP_CONTRACT_ADDRESS, SWAP_CONTRACT_ABI } from '../constants/contract.js';
export class SwapService {
    static async getXFIPrice() {
        try {
            const priceResult = await publicClient.readContract({
                address: SWAP_CONTRACT_ADDRESS,
                abi: SWAP_CONTRACT_ABI,
                functionName: 'getCurrentXFIPrice',
                args: [],
            });
            const priceInUSD = formatUnits(priceResult, 6);
            return parseFloat(priceInUSD);
        }
        catch (error) {
            console.error('Error getting XFI price from contract:', error);
            try {
                const marketData = await PriceAnalyticsService.getMarketData();
                return marketData.current_price;
            }
            catch (fallbackError) {
                console.error('Fallback price API also failed:', fallbackError);
                return 0.082;
            }
        }
    }
    static async checkLiquidity() {
        try {
            const reserves = await publicClient.readContract({
                address: SWAP_CONTRACT_ADDRESS,
                abi: SWAP_CONTRACT_ABI,
                functionName: 'getReserves',
                args: [],
            });
            const xfiReserve = reserves[0];
            const tUSDCReserve = reserves[1];
            const xfiReserveFormatted = formatUnits(xfiReserve, 18);
            const tUSDCReserveFormatted = formatUnits(tUSDCReserve, 6);
            const hasLiquidity = parseFloat(xfiReserveFormatted) > 0 && parseFloat(tUSDCReserveFormatted) > 0;
            return {
                hasLiquidity,
                xfiReserve: xfiReserveFormatted,
                tUSDCReserve: tUSDCReserveFormatted,
            };
        }
        catch (error) {
            console.error('Error checking liquidity:', error);
            return {
                hasLiquidity: false,
                xfiReserve: '0',
                tUSDCReserve: '0',
            };
        }
    }
    static async getSwapQuote(fromToken, toToken, fromAmount, slippage = 5) {
        try {
            const fromTokenMeta = Object.values(TOKEN_METADATA).find(t => t.symbol === fromToken || t.address.toLowerCase() === fromToken.toLowerCase());
            const toTokenMeta = Object.values(TOKEN_METADATA).find(t => t.symbol === toToken || t.address.toLowerCase() === toToken.toLowerCase());
            if (!fromTokenMeta || !toTokenMeta) {
                throw new Error('Token not found');
            }
            const liquidityCheck = await this.checkLiquidity();
            if (!liquidityCheck.hasLiquidity) {
                throw new Error('No liquidity available in the pool. Please add liquidity first.');
            }
            const fromAmountParsed = parseUnits(fromAmount, fromTokenMeta.decimals);
            let toAmountBigInt;
            let price;
            const xfiReserve = parseUnits(liquidityCheck.xfiReserve, 18);
            const tUSDCReserve = parseUnits(liquidityCheck.tUSDCReserve, 6);
            if (fromToken === 'tUSDC' && toToken === 'XFI') {
                const result = await publicClient.readContract({
                    address: SWAP_CONTRACT_ADDRESS,
                    abi: SWAP_CONTRACT_ABI,
                    functionName: 'getAmountOut',
                    args: [fromAmountParsed, tUSDCReserve, xfiReserve],
                });
                toAmountBigInt = result;
                const xfiAmount = formatUnits(toAmountBigInt, 18);
                price = parseFloat(fromAmount) / parseFloat(xfiAmount);
            }
            else if (fromToken === 'XFI' && toToken === 'tUSDC') {
                const result = await publicClient.readContract({
                    address: SWAP_CONTRACT_ADDRESS,
                    abi: SWAP_CONTRACT_ABI,
                    functionName: 'getAmountOut',
                    args: [fromAmountParsed, xfiReserve, tUSDCReserve],
                });
                toAmountBigInt = result;
                const tUSDCAmount = formatUnits(toAmountBigInt, 6);
                price = parseFloat(tUSDCAmount) / parseFloat(fromAmount);
            }
            else {
                throw new Error('Unsupported swap pair');
            }
            const toAmount = formatUnits(toAmountBigInt, toTokenMeta.decimals);
            const slippageMultiplier = (100 - slippage) / 100;
            const minimumReceived = (parseFloat(toAmount) * slippageMultiplier).toString();
            const gasFee = '0.002';
            return {
                fromToken: fromTokenMeta.symbol,
                toToken: toTokenMeta.symbol,
                fromAmount,
                toAmount,
                fromAmountFormatted: fromAmount,
                toAmountFormatted: parseFloat(toAmount).toFixed(6),
                price,
                slippage,
                minimumReceived,
                minimumReceivedFormatted: parseFloat(minimumReceived).toFixed(6),
                gasFee,
                gasFeeFormatted: gasFee,
            };
        }
        catch (error) {
            console.error('Error getting swap quote:', error);
            throw new Error('Failed to get swap quote');
        }
    }
    static async validateSwap(user, fromToken, fromAmount, slippage) {
        try {
            if (slippage < 0.1 || slippage > 50) {
                return {
                    valid: false,
                    error: 'Slippage must be between 0.1% and 50%',
                };
            }
            const amount = parseFloat(fromAmount);
            if (amount <= 0) {
                return {
                    valid: false,
                    error: 'Amount must be greater than 0',
                };
            }
            const fromTokenMeta = Object.values(TOKEN_METADATA).find(t => t.symbol === fromToken || t.address.toLowerCase() === fromToken.toLowerCase());
            if (!fromTokenMeta) {
                return {
                    valid: false,
                    error: 'Token not found',
                };
            }
            const balanceCheck = await TokenService.validateSufficientBalance(fromTokenMeta.address, user.walletAddress, fromAmount, true);
            if (!balanceCheck.sufficient) {
                return {
                    valid: false,
                    error: `Insufficient balance. Required: ${balanceCheck.required}, Available: ${balanceCheck.balance}`,
                    balanceCheck,
                };
            }
            return { valid: true, balanceCheck };
        }
        catch (error) {
            console.error('Error validating swap:', error);
            return {
                valid: false,
                error: 'Failed to validate swap',
            };
        }
    }
    static async executeSwap(user, fromToken, toToken, fromAmount, slippage = 5, maxSlippage = 10) {
        try {
            const validation = await this.validateSwap(user, fromToken, fromAmount, slippage);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                };
            }
            const quote = await this.getSwapQuote(fromToken, toToken, fromAmount, slippage);
            const currentPrice = await this.getXFIPrice();
            const priceChangePercentage = Math.abs((currentPrice - quote.price) / quote.price) * 100;
            if (priceChangePercentage > maxSlippage) {
                return {
                    success: false,
                    error: `Price changed by ${priceChangePercentage.toFixed(2)}% since quote. Please try again.`,
                };
            }
            const fromTokenMeta = Object.values(TOKEN_METADATA).find(t => t.symbol === fromToken);
            const toTokenMeta = Object.values(TOKEN_METADATA).find(t => t.symbol === toToken);
            if (!fromTokenMeta || !toTokenMeta) {
                return {
                    success: false,
                    error: 'Token metadata not found',
                };
            }
            let result;
            if (fromToken === 'tUSDC' && toToken === 'XFI') {
                result = await this.executeTUSDCToXFISwap(user, fromAmount, quote);
            }
            else if (fromToken === 'XFI' && toToken === 'tUSDC') {
                result = await this.executeXFIToTUSDCSwap(user, fromAmount, quote);
            }
            else {
                return {
                    success: false,
                    error: 'Unsupported swap pair',
                };
            }
            return result;
        }
        catch (error) {
            console.error('Error executing swap:', error);
            return {
                success: false,
                error: error.message || 'Failed to execute swap',
            };
        }
    }
    static async executeTUSDCToXFISwap(user, tUSDCAmount, quote) {
        try {
            console.log(`Executing tUSDC to XFI swap: ${tUSDCAmount} tUSDC -> ${quote.toAmount} XFI`);
            const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
            const tUSDCMeta = TOKEN_METADATA.tUSDC;
            const tUSDCAmount_BigInt = parseUnits(tUSDCAmount, tUSDCMeta.decimals);
            const minXFIAmount = parseUnits(quote.minimumReceived, 18);
            console.log('Step 1: Approving tUSDC spending...');
            const approvalHash = await walletClient.writeContract({
                address: TOKEN_ADDRESSES.tUSDC,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [SWAP_CONTRACT_ADDRESS, tUSDCAmount_BigInt],
            });
            const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
            if (approvalReceipt.status !== 'success') {
                throw new Error('Approval transaction failed');
            }
            console.log('Step 2: Executing tUSDC to XFI swap...');
            const swapHash = await walletClient.writeContract({
                address: SWAP_CONTRACT_ADDRESS,
                abi: SWAP_CONTRACT_ABI,
                functionName: 'swapTUSDCForXFI',
                args: [tUSDCAmount_BigInt, minXFIAmount],
            });
            const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
            if (swapReceipt.status === 'success') {
                console.log(`✅ tUSDC to XFI swap successful. Transaction: ${swapReceipt.transactionHash}`);
                return {
                    success: true,
                    transactionHash: swapReceipt.transactionHash,
                    fromAmount: tUSDCAmount,
                    toAmount: quote.toAmount,
                    actualPrice: quote.price,
                };
            }
            else {
                throw new Error('Swap transaction failed');
            }
        }
        catch (error) {
            console.error('Error executing tUSDC to XFI swap:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    static async executeXFIToTUSDCSwap(user, xfiAmount, quote) {
        try {
            console.log(`Executing XFI to tUSDC swap: ${xfiAmount} XFI -> ${quote.toAmount} tUSDC`);
            const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
            const xfiAmount_BigInt = parseUnits(xfiAmount, 18);
            const minTUSDCAmount = parseUnits(quote.minimumReceived, 6);
            console.log('Executing XFI to tUSDC swap...');
            const swapHash = await walletClient.writeContract({
                address: SWAP_CONTRACT_ADDRESS,
                abi: SWAP_CONTRACT_ABI,
                functionName: 'swapXFIForTUSDC',
                args: [minTUSDCAmount],
                value: xfiAmount_BigInt,
            });
            const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapHash });
            if (swapReceipt.status === 'success') {
                console.log(`✅ XFI to tUSDC swap successful. Transaction: ${swapReceipt.transactionHash}`);
                return {
                    success: true,
                    transactionHash: swapReceipt.transactionHash,
                    fromAmount: xfiAmount,
                    toAmount: quote.toAmount,
                    actualPrice: quote.price,
                };
            }
            else {
                throw new Error('Swap transaction failed');
            }
        }
        catch (error) {
            console.error('Error executing XFI to tUSDC swap:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    static async getSwapHistory(userId, limit = 10) {
        console.log(`Getting swap history for user ${userId}, limit: ${limit}`);
        return [];
    }
    static async getBestSwapRoute(fromToken, toToken, amount) {
        return await this.getSwapQuote(fromToken, toToken, amount);
    }
    static async calculatePriceImpact(fromToken, toToken, amount) {
        try {
            const largeAmount = (parseFloat(amount) * 10).toString();
            const normalQuote = await this.getSwapQuote(fromToken, toToken, amount);
            const largeQuote = await this.getSwapQuote(fromToken, toToken, largeAmount);
            const normalPrice = parseFloat(normalQuote.toAmount) / parseFloat(normalQuote.fromAmount);
            const largePrice = parseFloat(largeQuote.toAmount) / parseFloat(largeQuote.fromAmount);
            const priceImpact = Math.abs((largePrice - normalPrice) / normalPrice) * 100;
            return Math.min(priceImpact, 0.1);
        }
        catch (error) {
            console.error('Error calculating price impact:', error);
            return 0;
        }
    }
    static async getSwapGasFee(fromToken, toToken) {
        try {
            const baseGas = fromToken === 'tUSDC' ? '0.002' : '0.001';
            return {
                gasFee: baseGas,
                gasFeeFormatted: baseGas,
            };
        }
        catch (error) {
            console.error('Error estimating gas fee:', error);
            return {
                gasFee: '0.001',
                gasFeeFormatted: '0.001',
            };
        }
    }
    static async addLiquidity(user, xfiAmount, tUSDCAmount, slippage = 5) {
        try {
            console.log(`Adding liquidity: ${xfiAmount} XFI + ${tUSDCAmount} tUSDC`);
            const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
            const xfiAmountParsed = parseUnits(xfiAmount, 18);
            const tUSDCAmountParsed = parseUnits(tUSDCAmount, 6);
            const slippageMultiplier = (100 - slippage) / 100;
            const minXFIAmount = parseUnits((parseFloat(xfiAmount) * slippageMultiplier).toString(), 18);
            const minTUSDCAmount = parseUnits((parseFloat(tUSDCAmount) * slippageMultiplier).toString(), 6);
            console.log('Step 1: Approving tUSDC spending for liquidity...');
            const approvalHash = await walletClient.writeContract({
                address: TOKEN_ADDRESSES.tUSDC,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [SWAP_CONTRACT_ADDRESS, tUSDCAmountParsed],
            });
            const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
            if (approvalReceipt.status !== 'success') {
                throw new Error('Approval transaction failed');
            }
            console.log('Step 2: Adding liquidity...');
            const liquidityHash = await walletClient.writeContract({
                address: SWAP_CONTRACT_ADDRESS,
                abi: SWAP_CONTRACT_ABI,
                functionName: 'addLiquidity',
                args: [tUSDCAmountParsed, minXFIAmount, minTUSDCAmount],
                value: xfiAmountParsed,
            });
            const liquidityReceipt = await publicClient.waitForTransactionReceipt({ hash: liquidityHash });
            if (liquidityReceipt.status === 'success') {
                console.log(`✅ Liquidity added successfully. Transaction: ${liquidityReceipt.transactionHash}`);
                return {
                    success: true,
                    transactionHash: liquidityReceipt.transactionHash,
                };
            }
            else {
                throw new Error('Liquidity transaction failed');
            }
        }
        catch (error) {
            console.error('Error adding liquidity:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}
//# sourceMappingURL=swap.js.map