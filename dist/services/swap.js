import { parseUnits, formatUnits } from 'viem';
import { config } from 'dotenv';
import { SWAP_ROUTER_ADDRESS, SWAP_ROUTER_ABI } from '../constants/contract.js';
import { TOKEN_ADDRESSES, SWAP_CONFIG, validateSwapSlippage, isSupportedSwapToken, getTokenBySymbol } from '../constants/tokens.js';
import { SwapErrorCode } from '../types/swap.js';
import { publicClient, createWalletClientFromPrivateKey } from '../config/viem.js';
config();
const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            { "name": "_owner", "type": "address" },
            { "name": "_spender", "type": "address" }
        ],
        "name": "allowance",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "_spender", "type": "address" },
            { "name": "_value", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    }
];
export class SwapService {
    static async getSwapQuote(params) {
        try {
            const { fromToken, toToken, fromAmount, slippage = SWAP_CONFIG.DEFAULT_SLIPPAGE } = params;
            if (!isSupportedSwapToken(fromToken) || !isSupportedSwapToken(toToken)) {
                throw new Error(`Unsupported token pair: ${fromToken} to ${toToken}`);
            }
            if (!validateSwapSlippage(slippage)) {
                throw new Error(`Invalid slippage: ${slippage}%. Must be between ${SWAP_CONFIG.MIN_SLIPPAGE}% and ${SWAP_CONFIG.MAX_SLIPPAGE}%`);
            }
            const fromTokenMeta = getTokenBySymbol(fromToken);
            const toTokenMeta = getTokenBySymbol(toToken);
            if (!fromTokenMeta || !toTokenMeta) {
                throw new Error('Invalid token symbols');
            }
            const fromTokenAddress = fromTokenMeta.address;
            const toTokenAddress = toTokenMeta.address;
            const fromAmountWei = parseUnits(fromAmount, fromTokenMeta.decimals);
            const isNativeXFI = fromToken === 'CFI' || fromToken === 'XFI';
            const isToNativeXFI = toToken === 'CFI' || toToken === 'XFI';
            let path;
            if (isNativeXFI && !isToNativeXFI) {
                path = [TOKEN_ADDRESSES.WXFI, toTokenAddress];
            }
            else if (!isNativeXFI && isToNativeXFI) {
                path = [fromTokenAddress, TOKEN_ADDRESSES.WXFI];
            }
            else {
                path = [fromTokenAddress, toTokenAddress];
            }
            const amountsOut = await publicClient.readContract({
                address: SWAP_ROUTER_ADDRESS,
                abi: SWAP_ROUTER_ABI,
                functionName: 'getAmountsOut',
                args: [fromAmountWei, path],
            });
            if (!amountsOut || amountsOut.length < 2) {
                throw new Error('Failed to get swap quote');
            }
            const toAmountWei = amountsOut[amountsOut.length - 1];
            const toAmount = formatUnits(toAmountWei, toTokenMeta.decimals);
            const priceImpact = 0.1;
            const slippageMultiplier = (100 - slippage) / 100;
            const minimumReceivedWei = toAmountWei * BigInt(Math.floor(slippageMultiplier * 1000)) / 1000n;
            const minimumReceived = formatUnits(minimumReceivedWei, toTokenMeta.decimals);
            const gasEstimate = path.length > 2 ? '200000' : '150000';
            const deadline = Math.floor(Date.now() / 1000) + (SWAP_CONFIG.DEADLINE_MINUTES * 60);
            const price = parseFloat(toAmount) / parseFloat(fromAmount);
            return {
                fromToken,
                toToken,
                fromAmount,
                toAmount,
                fromAmountFormatted: `${fromAmount} ${fromToken}`,
                toAmountFormatted: `${toAmount} ${toToken}`,
                price,
                priceImpact,
                minimumReceived,
                minimumReceivedFormatted: `${minimumReceived} ${toToken}`,
                gasEstimate,
                gasEstimateFormatted: `${gasEstimate} gas`,
                slippage,
                path,
                deadline,
            };
        }
        catch (error) {
            console.error('Error getting swap quote:', error);
            throw new Error(`Failed to get swap quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    static async validateSwap(user, params) {
        try {
            const { fromToken, toToken, fromAmount, slippage = SWAP_CONFIG.DEFAULT_SLIPPAGE } = params;
            if (!isSupportedSwapToken(fromToken) || !isSupportedSwapToken(toToken)) {
                return {
                    valid: false,
                    error: `Unsupported token pair: ${fromToken} to ${toToken}`,
                };
            }
            if (!validateSwapSlippage(slippage)) {
                return {
                    valid: false,
                    error: `Invalid slippage: ${slippage}%. Must be between ${SWAP_CONFIG.MIN_SLIPPAGE}% and ${SWAP_CONFIG.MAX_SLIPPAGE}%`,
                };
            }
            const fromTokenMeta = getTokenBySymbol(fromToken);
            if (!fromTokenMeta) {
                return {
                    valid: false,
                    error: `Invalid from token: ${fromToken}`,
                };
            }
            if (!user.walletAddress) {
                return {
                    valid: false,
                    error: 'User has no wallet address',
                };
            }
            const userAddress = user.walletAddress;
            let balance;
            if (fromTokenMeta.isNative) {
                balance = await publicClient.getBalance({ address: userAddress });
            }
            else {
                balance = await publicClient.readContract({
                    address: fromTokenMeta.address,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress],
                });
            }
            const requiredAmount = parseUnits(fromAmount, fromTokenMeta.decimals);
            const balanceFormatted = formatUnits(balance, fromTokenMeta.decimals);
            if (balance < requiredAmount) {
                return {
                    valid: false,
                    error: `Insufficient ${fromToken} balance. Required: ${fromAmount}, Available: ${balanceFormatted}`,
                    balance: balanceFormatted,
                };
            }
            let allowance = 0n;
            let needsApproval = false;
            if (!fromTokenMeta.isNative) {
                allowance = await publicClient.readContract({
                    address: fromTokenMeta.address,
                    abi: ERC20_ABI,
                    functionName: 'allowance',
                    args: [userAddress, SWAP_ROUTER_ADDRESS],
                });
                needsApproval = allowance < requiredAmount;
            }
            const warnings = [];
            if (needsApproval) {
                warnings.push(`Token approval required for ${fromToken}`);
            }
            return {
                valid: true,
                balance: balanceFormatted,
                allowance: formatUnits(allowance, fromTokenMeta.decimals),
                needsApproval,
                warnings,
            };
        }
        catch (error) {
            console.error('Error validating swap:', error);
            return {
                valid: false,
                error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }
    static async executeSwap(user, params) {
        try {
            console.log(`🔄 Executing swap: ${params.fromAmount} ${params.fromToken} -> ${params.toToken}`);
            const validation = await this.validateSwap(user, params);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                    errorCode: SwapErrorCode.INVALID_TOKEN_PAIR,
                    fromAmount: params.fromAmount,
                    fromToken: params.fromToken,
                    toToken: params.toToken,
                };
            }
            const quote = await this.getSwapQuote(params);
            if (!quote) {
                return {
                    success: false,
                    error: 'Failed to get swap quote',
                    errorCode: SwapErrorCode.UNKNOWN_ERROR,
                    fromAmount: params.fromAmount,
                    fromToken: params.fromToken,
                    toToken: params.toToken,
                };
            }
            if (validation.needsApproval) {
                const approvalResult = await this.approveToken(user, params.fromToken, params.fromAmount);
                if (!approvalResult.success) {
                    return {
                        success: false,
                        error: `Token approval failed: ${approvalResult.error}`,
                        errorCode: SwapErrorCode.INSUFFICIENT_ALLOWANCE,
                        fromAmount: params.fromAmount,
                        fromToken: params.fromToken,
                        toToken: params.toToken,
                    };
                }
            }
            const swapResult = await this.executeSwapTransaction(user, quote, params);
            return swapResult;
        }
        catch (error) {
            console.error('Error executing swap:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: SwapErrorCode.UNKNOWN_ERROR,
                fromAmount: params.fromAmount,
                fromToken: params.fromToken,
                toToken: params.toToken,
            };
        }
    }
    static async approveToken(user, tokenSymbol, amount) {
        try {
            const tokenMeta = getTokenBySymbol(tokenSymbol);
            if (!tokenMeta || tokenMeta.isNative) {
                return { success: true };
            }
            const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY;
            if (!fundingPrivateKey) {
                return { success: false, error: 'Funding wallet not configured' };
            }
            const walletClient = createWalletClientFromPrivateKey(fundingPrivateKey);
            if (!walletClient) {
                return { success: false, error: 'Failed to create wallet client' };
            }
            const amountWei = parseUnits(amount, tokenMeta.decimals);
            const hash = await walletClient.writeContract({
                address: tokenMeta.address,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [SWAP_ROUTER_ADDRESS, amountWei],
                chain: undefined,
                account: walletClient.account,
            });
            console.log(`✅ Token approval successful: ${hash}`);
            return { success: true };
        }
        catch (error) {
            console.error('Error approving token:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    static async executeSwapTransaction(user, quote, params) {
        try {
            if (!user.encryptedPrivateKey) {
                return {
                    success: false,
                    error: 'User wallet not configured',
                    errorCode: SwapErrorCode.UNKNOWN_ERROR,
                    fromAmount: params.fromAmount,
                    fromToken: params.fromToken,
                    toToken: params.toToken,
                };
            }
            const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
            if (!walletClient) {
                return {
                    success: false,
                    error: 'Failed to create wallet client',
                    errorCode: SwapErrorCode.UNKNOWN_ERROR,
                    fromAmount: params.fromAmount,
                    fromToken: params.fromToken,
                    toToken: params.toToken,
                };
            }
            const fromTokenMeta = getTokenBySymbol(params.fromToken);
            const toTokenMeta = getTokenBySymbol(params.toToken);
            if (!fromTokenMeta || !toTokenMeta) {
                return {
                    success: false,
                    error: 'Invalid token metadata',
                    errorCode: SwapErrorCode.INVALID_TOKEN_PAIR,
                    fromAmount: params.fromAmount,
                    fromToken: params.fromToken,
                    toToken: params.toToken,
                };
            }
            const fromAmountWei = parseUnits(params.fromAmount, fromTokenMeta.decimals);
            const minimumReceivedWei = parseUnits(quote.minimumReceived, toTokenMeta.decimals);
            const recipient = (params.recipient || user.walletAddress);
            let hash;
            if (fromTokenMeta.isNative) {
                hash = await walletClient.writeContract({
                    address: SWAP_ROUTER_ADDRESS,
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'swapExactETHForTokens',
                    args: [
                        minimumReceivedWei,
                        quote.path,
                        recipient,
                        BigInt(quote.deadline)
                    ],
                    value: fromAmountWei,
                });
            }
            else if (toTokenMeta.isNative) {
                hash = await walletClient.writeContract({
                    address: SWAP_ROUTER_ADDRESS,
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'swapExactTokensForETH',
                    args: [
                        fromAmountWei,
                        minimumReceivedWei,
                        quote.path,
                        recipient,
                        BigInt(quote.deadline)
                    ],
                });
            }
            else {
                hash = await walletClient.writeContract({
                    address: SWAP_ROUTER_ADDRESS,
                    abi: SWAP_ROUTER_ABI,
                    functionName: 'swapExactTokensForTokens',
                    args: [
                        fromAmountWei,
                        minimumReceivedWei,
                        quote.path,
                        recipient,
                        BigInt(quote.deadline)
                    ],
                });
            }
            console.log(`✅ Swap transaction submitted: ${hash}`);
            const receipt = await publicClient.waitForTransactionReceipt({ hash: hash });
            return {
                success: true,
                transactionHash: hash,
                fromAmount: params.fromAmount,
                toAmount: quote.toAmount,
                fromToken: params.fromToken,
                toToken: params.toToken,
                gasUsed: receipt.gasUsed?.toString(),
                gasPrice: receipt.effectiveGasPrice?.toString(),
            };
        }
        catch (error) {
            console.error('Error executing swap transaction:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                errorCode: SwapErrorCode.TRANSACTION_FAILED,
                fromAmount: params.fromAmount,
                fromToken: params.fromToken,
                toToken: params.toToken,
            };
        }
    }
    static getSupportedPairs() {
        const pairs = [];
        const tokens = SWAP_CONFIG.SUPPORTED_TOKENS;
        for (let i = 0; i < tokens.length; i++) {
            for (let j = 0; j < tokens.length; j++) {
                if (i !== j) {
                    pairs.push({
                        from: tokens[i],
                        to: tokens[j],
                        description: `Swap ${tokens[i]} for ${tokens[j]}`,
                    });
                }
            }
        }
        return pairs;
    }
    static getSwapConfig() {
        return SWAP_CONFIG;
    }
}
//# sourceMappingURL=swap.js.map