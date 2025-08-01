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
            if (fromToken === 'USDT' || toToken === 'USDT') {
                throw new Error('USDT swaps are temporarily disabled. Please use USDC instead.');
            }
            let path;
            if (isNativeXFI && !isToNativeXFI) {
                path = [TOKEN_ADDRESSES.WXFI, toTokenAddress];
            }
            else if (!isNativeXFI && isToNativeXFI) {
                path = [fromTokenAddress, TOKEN_ADDRESSES.WXFI];
            }
            else if (isNativeXFI && isToNativeXFI) {
                throw new Error('Cannot swap XFI to XFI');
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
            if (fromToken === 'USDT' || toToken === 'USDT') {
                return {
                    valid: false,
                    error: 'USDT swaps are temporarily disabled. Please use USDC instead.',
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
            let actualFromToken = fromToken;
            let actualFromTokenMeta = fromTokenMeta;
            if (fromToken === 'WXFI' && toToken === 'USDC') {
                console.log(`🔍 SwapService.validateSwap: XFI to USDC swap detected, checking native XFI balance`);
                actualFromToken = 'XFI';
                actualFromTokenMeta = getTokenBySymbol('XFI');
            }
            let balance;
            if (actualFromTokenMeta.isNative) {
                balance = await publicClient.getBalance({ address: userAddress });
                console.log(`🔍 SwapService.validateSwap: Native ${actualFromToken} balance: ${formatUnits(balance, actualFromTokenMeta.decimals)}`);
            }
            else {
                balance = await publicClient.readContract({
                    address: actualFromTokenMeta.address,
                    abi: ERC20_ABI,
                    functionName: 'balanceOf',
                    args: [userAddress],
                });
                console.log(`🔍 SwapService.validateSwap: ERC20 ${actualFromToken} balance: ${formatUnits(balance, actualFromTokenMeta.decimals)}`);
            }
            const requiredAmount = parseUnits(fromAmount, fromTokenMeta.decimals);
            const balanceFormatted = formatUnits(balance, fromTokenMeta.decimals);
            if (balance < requiredAmount) {
                return {
                    valid: false,
                    error: `Insufficient ${actualFromToken} balance. Required: ${fromAmount}, Available: ${balanceFormatted}`,
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
            console.log(`🔄 SwapService.executeSwap: Starting swap execution`);
            console.log(`   User wallet: ${user.walletAddress}`);
            console.log(`   From: ${params.fromAmount} ${params.fromToken}`);
            console.log(`   To: ${params.toToken}`);
            console.log(`   Slippage: ${params.slippage}%`);
            console.log(`🔍 SwapService.executeSwap: Validating swap...`);
            const validation = await this.validateSwap(user, params);
            console.log(`   Validation result: ${validation.valid ? '✅ Valid' : '❌ Invalid'}`);
            if (!validation.valid) {
                console.log(`   Validation error: ${validation.error}`);
                return {
                    success: false,
                    error: validation.error,
                    errorCode: SwapErrorCode.INVALID_TOKEN_PAIR,
                    fromAmount: params.fromAmount,
                    fromToken: params.fromToken,
                    toToken: params.toToken,
                };
            }
            console.log(`💰 SwapService.executeSwap: Getting swap quote...`);
            const quote = await this.getSwapQuote(params);
            if (!quote) {
                console.log(`   ❌ Failed to get swap quote`);
                return {
                    success: false,
                    error: 'Failed to get swap quote',
                    errorCode: SwapErrorCode.UNKNOWN_ERROR,
                    fromAmount: params.fromAmount,
                    fromToken: params.fromToken,
                    toToken: params.toToken,
                };
            }
            console.log(`   ✅ Quote received: ${quote.fromAmountFormatted} → ${quote.toAmountFormatted}`);
            console.log(`🔐 SwapService.executeSwap: Checking approval...`);
            console.log(`   Needs approval: ${validation.needsApproval ? 'Yes' : 'No'}`);
            if (validation.needsApproval) {
                console.log(`   🔐 Approving token: ${params.fromToken}`);
                const approvalResult = await this.approveToken(user, params.fromToken, params.fromAmount);
                console.log(`   Approval result: ${approvalResult.success ? '✅ Success' : '❌ Failed'}`);
                if (!approvalResult.success) {
                    console.log(`   Approval error: ${approvalResult.error}`);
                    return {
                        success: false,
                        error: `Token approval failed: ${approvalResult.error}`,
                        errorCode: SwapErrorCode.INSUFFICIENT_ALLOWANCE,
                        fromAmount: params.fromAmount,
                        fromToken: params.fromToken,
                        toToken: params.toToken,
                    };
                }
                console.log(`   ⏳ Waiting for approval transaction to be processed...`);
                let allowance = 0n;
                let retryCount = 0;
                const maxRetries = 5;
                while (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    retryCount++;
                    try {
                        const { getTokenBySymbol } = await import('../constants/tokens.js');
                        const tokenMeta = getTokenBySymbol(params.fromToken);
                        const requiredAmount = parseUnits(params.fromAmount, tokenMeta.decimals);
                        allowance = await publicClient.readContract({
                            address: tokenMeta.address,
                            abi: ERC20_ABI,
                            functionName: 'allowance',
                            args: [user.walletAddress, SWAP_ROUTER_ADDRESS],
                        });
                        console.log(`   🔍 Attempt ${retryCount}: Current allowance: ${formatUnits(allowance, tokenMeta.decimals)} ${params.fromToken}`);
                        console.log(`   🔍 Required amount: ${formatUnits(requiredAmount, tokenMeta.decimals)} ${params.fromToken}`);
                        if (allowance >= requiredAmount) {
                            console.log(`   ✅ Sufficient allowance confirmed after ${retryCount} attempts`);
                            break;
                        }
                        else if (retryCount === maxRetries) {
                            console.log(`   ❌ Insufficient allowance after ${maxRetries} attempts`);
                            return {
                                success: false,
                                error: `Insufficient allowance after approval. Required: ${formatUnits(requiredAmount, tokenMeta.decimals)}, Allowed: ${formatUnits(allowance, tokenMeta.decimals)}`,
                                errorCode: SwapErrorCode.INSUFFICIENT_ALLOWANCE,
                                fromAmount: params.fromAmount,
                                fromToken: params.fromToken,
                                toToken: params.toToken,
                            };
                        }
                        else {
                            console.log(`   ⏳ Retrying allowance check (${retryCount}/${maxRetries})...`);
                        }
                    }
                    catch (error) {
                        console.log(`   ⚠️ Error checking allowance (attempt ${retryCount}): ${error}`);
                        if (retryCount === maxRetries) {
                            console.log(`   ⚠️ Could not verify allowance after ${maxRetries} attempts, proceeding anyway`);
                            break;
                        }
                    }
                }
            }
            let wrapHash;
            let wrapGasUsed;
            let wrapGasPrice;
            const isXFIToUSDC = params.fromToken === 'WXFI' && params.toToken === 'USDC';
            const isWXFIInPath = quote.path.includes(TOKEN_ADDRESSES.WXFI);
            console.log(`🔍 SwapService.executeSwap: Checking XFI wrapping...`);
            console.log(`   Is XFI to USDC swap: ${isXFIToUSDC}`);
            console.log(`   WXFI in path: ${isWXFIInPath}`);
            if (isXFIToUSDC && isWXFIInPath) {
                console.log(`🔄 Checking if we need to wrap native XFI to WXFI...`);
                try {
                    const nativeXfiBalance = await publicClient.getBalance({ address: user.walletAddress });
                    const requiredAmount = parseUnits(params.fromAmount, 18);
                    console.log(`   🔍 Native XFI balance: ${formatUnits(nativeXfiBalance, 18)} XFI`);
                    console.log(`   🔍 Required amount: ${params.fromAmount} XFI`);
                    if (nativeXfiBalance >= requiredAmount) {
                        console.log(`🔄 Wrapping ${params.fromAmount} native XFI to WXFI...`);
                        const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
                        wrapHash = await walletClient.writeContract({
                            address: TOKEN_ADDRESSES.WXFI,
                            abi: [
                                { "inputs": [], "name": "deposit", "outputs": [], "stateMutability": "payable", "type": "function" }
                            ],
                            functionName: 'deposit',
                            value: requiredAmount,
                            chain: undefined,
                            account: walletClient.account,
                        });
                        console.log(`✅ XFI to WXFI wrapping submitted: ${wrapHash}`);
                        const wrapReceipt = await publicClient.waitForTransactionReceipt({ hash: wrapHash });
                        wrapGasUsed = wrapReceipt.gasUsed?.toString();
                        wrapGasPrice = wrapReceipt.effectiveGasPrice?.toString();
                        console.log(`✅ XFI to WXFI wrapping confirmed: ${wrapHash}`);
                    }
                    else {
                        console.log(`❌ Insufficient native XFI balance for wrapping`);
                        return {
                            success: false,
                            error: `Insufficient native XFI balance. Required: ${params.fromAmount}, Available: ${formatUnits(nativeXfiBalance, 18)}`,
                            errorCode: SwapErrorCode.INSUFFICIENT_BALANCE,
                            fromAmount: params.fromAmount,
                            fromToken: params.fromToken,
                            toToken: params.toToken,
                        };
                    }
                }
                catch (error) {
                    console.error('❌ Error wrapping XFI to WXFI:', error);
                    return {
                        success: false,
                        error: `Failed to wrap XFI to WXFI: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        errorCode: SwapErrorCode.TRANSACTION_FAILED,
                        fromAmount: params.fromAmount,
                        fromToken: params.fromToken,
                        toToken: params.toToken,
                    };
                }
            }
            console.log(`🚀 SwapService.executeSwap: Executing swap transaction...`);
            const swapResult = await this.executeSwapTransaction(user, quote, params);
            console.log(`   Swap result: ${swapResult.success ? '✅ Success' : '❌ Failed'}`);
            if (swapResult.success) {
                console.log(`   Transaction hash: ${swapResult.transactionHash}`);
                console.log(`   Wrap hash: ${wrapHash || 'None'}`);
                console.log(`   Unwrap hash: ${swapResult.unwrapTransactionHash || 'None'}`);
                if (wrapHash) {
                    swapResult.wrapTransactionHash = wrapHash;
                    swapResult.wrapGasUsed = wrapGasUsed;
                    swapResult.wrapGasPrice = wrapGasPrice;
                }
            }
            else {
                console.log(`   Error: ${swapResult.error}`);
                console.log(`   Error code: ${swapResult.errorCode}`);
            }
            return swapResult;
        }
        catch (error) {
            console.error('❌ SwapService.executeSwap: Error executing swap:', error);
            console.error('   Error message:', error instanceof Error ? error.message : 'Unknown error');
            console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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
            if (!user.encryptedPrivateKey) {
                return { success: false, error: 'User wallet not configured' };
            }
            const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
            if (!walletClient) {
                return { success: false, error: 'Failed to create wallet client' };
            }
            const amountWei = parseUnits(amount, tokenMeta.decimals);
            const approvalAmount = amountWei * 110n / 100n;
            console.log(`🔐 SwapService.approveToken: Approving ${formatUnits(approvalAmount, tokenMeta.decimals)} ${tokenSymbol} (with 10% buffer)`);
            const hash = await walletClient.writeContract({
                address: tokenMeta.address,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [SWAP_ROUTER_ADDRESS, approvalAmount],
                chain: undefined,
                account: walletClient.account,
            });
            console.log(`✅ Token approval successful for user ${user.walletAddress}: ${hash}`);
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
            console.log(`🔄 SwapService.executeSwapTransaction: Starting transaction execution`);
            console.log(`   User wallet: ${user.walletAddress}`);
            console.log(`   Quote path: ${quote.path.join(' -> ')}`);
            console.log(`   Expected output: ${quote.toAmountFormatted} ${params.toToken}`);
            if (!user.encryptedPrivateKey) {
                console.log(`❌ SwapService.executeSwapTransaction: User wallet not configured`);
                return {
                    success: false,
                    error: 'User wallet not configured',
                    errorCode: SwapErrorCode.UNKNOWN_ERROR,
                    fromAmount: params.fromAmount,
                    fromToken: params.fromToken,
                    toToken: params.toToken,
                };
            }
            console.log(`🔑 SwapService.executeSwapTransaction: Creating wallet client...`);
            const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
            if (!walletClient) {
                console.log(`❌ SwapService.executeSwapTransaction: Failed to create wallet client`);
                return {
                    success: false,
                    error: 'Failed to create wallet client',
                    errorCode: SwapErrorCode.UNKNOWN_ERROR,
                    fromAmount: params.fromAmount,
                    fromToken: params.fromToken,
                    toToken: params.toToken,
                };
            }
            console.log(`✅ SwapService.executeSwapTransaction: Wallet client created successfully`);
            console.log(`🔍 SwapService.executeSwapTransaction: Getting token metadata...`);
            const fromTokenMeta = getTokenBySymbol(params.fromToken);
            const toTokenMeta = getTokenBySymbol(params.toToken);
            console.log(`   From token: ${params.fromToken} (${fromTokenMeta ? 'Found' : 'Not found'})`);
            console.log(`   To token: ${params.toToken} (${toTokenMeta ? 'Found' : 'Not found'})`);
            if (!fromTokenMeta || !toTokenMeta) {
                console.log(`❌ SwapService.executeSwapTransaction: Invalid token metadata`);
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
            let unwrapHash;
            let unwrapGasUsed;
            let unwrapGasPrice;
            const isUSDCToXFI = params.fromToken === 'USDC' && params.toToken === 'WXFI';
            const isWXFIInPath = quote.path.includes(TOKEN_ADDRESSES.WXFI);
            console.log(`🔍 SwapService.executeSwapTransaction: Checking WXFI conversion...`);
            console.log(`   Is USDC to XFI swap: ${isUSDCToXFI}`);
            console.log(`   WXFI in path: ${isWXFIInPath}`);
            if (isUSDCToXFI && isWXFIInPath) {
                console.log(`🔄 Converting WXFI to native XFI...`);
                try {
                    const wxfiBalance = await publicClient.readContract({
                        address: TOKEN_ADDRESSES.WXFI,
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [user.walletAddress],
                    });
                    if (wxfiBalance > 0n) {
                        unwrapHash = await walletClient.writeContract({
                            address: TOKEN_ADDRESSES.WXFI,
                            abi: [
                                { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
                            ],
                            functionName: 'withdraw',
                            args: [wxfiBalance],
                            chain: undefined,
                            account: walletClient.account,
                        });
                        console.log(`✅ WXFI to XFI conversion submitted: ${unwrapHash}`);
                        const unwrapReceipt = await publicClient.waitForTransactionReceipt({ hash: unwrapHash });
                        unwrapGasUsed = unwrapReceipt.gasUsed?.toString();
                        unwrapGasPrice = unwrapReceipt.effectiveGasPrice?.toString();
                        console.log(`✅ WXFI to XFI conversion confirmed: ${unwrapHash}`);
                    }
                }
                catch (error) {
                    console.error('❌ Error converting WXFI to XFI:', error);
                }
            }
            else {
                console.log(`⏭️ Skipping WXFI conversion - not a USDC to XFI swap or WXFI not in path`);
            }
            return {
                success: true,
                transactionHash: hash,
                unwrapTransactionHash: unwrapHash,
                fromAmount: params.fromAmount,
                toAmount: quote.toAmount,
                fromToken: params.fromToken,
                toToken: params.toToken,
                gasUsed: receipt.gasUsed?.toString(),
                gasPrice: receipt.effectiveGasPrice?.toString(),
                unwrapGasUsed,
                unwrapGasPrice,
                finalToken: unwrapHash ? 'XFI (native)' : params.toToken,
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