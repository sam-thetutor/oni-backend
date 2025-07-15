import { parseUnits, formatUnits } from 'viem';
import { publicClient, createWalletClientFromPrivateKey } from '../config/viem.js';
import { ERC20_ABI } from '../constants/abi.js';
import { TOKEN_ADDRESSES, TOKEN_METADATA, getTokenBySymbol } from '../constants/tokens.js';
export class TokenService {
    static async verifyERC20Contract(tokenAddress) {
        try {
            console.log(`Verifying contract at ${tokenAddress}`);
            const code = await publicClient.getBytecode({ address: tokenAddress });
            if (!code || code === '0x') {
                console.log(`No contract code found at ${tokenAddress}`);
                return { exists: false, isERC20: false, details: { reason: 'No contract code' } };
            }
            try {
                const [name, symbol, decimals] = await Promise.all([
                    publicClient.readContract({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: 'name',
                        args: [],
                    }),
                    publicClient.readContract({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: 'symbol',
                        args: [],
                    }),
                    publicClient.readContract({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: 'decimals',
                        args: [],
                    }),
                ]);
                console.log(`Contract verification successful for ${tokenAddress}:`, { name, symbol, decimals });
                return {
                    exists: true,
                    isERC20: true,
                    details: { name, symbol, decimals }
                };
            }
            catch (erc20Error) {
                console.log(`Contract exists at ${tokenAddress} but doesn't implement ERC20:`, erc20Error);
                return {
                    exists: true,
                    isERC20: false,
                    details: { reason: 'Not ERC20 compatible', error: erc20Error }
                };
            }
        }
        catch (error) {
            console.error(`Error verifying contract at ${tokenAddress}:`, error);
            return {
                exists: false,
                isERC20: false,
                details: { reason: 'Verification failed', error }
            };
        }
    }
    static async getTokenBalance(tokenAddress, walletAddress) {
        try {
            if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
                const balance = await publicClient.getBalance({ address: walletAddress });
                return {
                    address: walletAddress,
                    balance: balance.toString(),
                    formatted: formatUnits(balance, 18),
                    symbol: 'XFI',
                    decimals: 18,
                };
            }
            const knownToken = Object.values(TOKEN_METADATA).find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
            if (knownToken) {
                try {
                    const balance = await publicClient.readContract({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [walletAddress],
                    });
                    return {
                        address: walletAddress,
                        balance: balance.toString(),
                        formatted: formatUnits(balance, knownToken.decimals),
                        symbol: knownToken.symbol,
                        decimals: knownToken.decimals,
                    };
                }
                catch (balanceError) {
                    console.error(`Error getting balance for known token ${knownToken.symbol} at ${tokenAddress}:`, balanceError);
                    console.error('Balance error details:', {
                        tokenAddress,
                        walletAddress,
                        knownTokenDecimals: knownToken.decimals,
                        errorMessage: balanceError instanceof Error ? balanceError.message : 'Unknown error'
                    });
                    return {
                        address: walletAddress,
                        balance: '0',
                        formatted: '0',
                        symbol: knownToken.symbol,
                        decimals: knownToken.decimals,
                    };
                }
            }
            try {
                const [balance, decimals, symbol] = await Promise.all([
                    publicClient.readContract({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: 'balanceOf',
                        args: [walletAddress],
                    }),
                    publicClient.readContract({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: 'decimals',
                        args: [],
                    }),
                    publicClient.readContract({
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: 'symbol',
                        args: [],
                    }),
                ]);
                return {
                    address: walletAddress,
                    balance: balance.toString(),
                    formatted: formatUnits(balance, decimals),
                    symbol,
                    decimals,
                };
            }
            catch (contractError) {
                console.error(`Error reading contract ${tokenAddress}:`, contractError);
                throw new Error(`Failed to read token contract at ${tokenAddress}`);
            }
        }
        catch (error) {
            console.error('Error getting token balance:', error);
            throw new Error('Failed to get token balance');
        }
    }
    static async getMultipleTokenBalances(tokenAddresses, walletAddress) {
        const results = [];
        for (const address of tokenAddresses) {
            try {
                const balance = await this.getTokenBalance(address, walletAddress);
                results.push(balance);
            }
            catch (error) {
                console.error(`Failed to get balance for token ${address}:`, error);
                const knownToken = Object.values(TOKEN_METADATA).find(t => t.address.toLowerCase() === address.toLowerCase());
                if (knownToken) {
                    results.push({
                        address: walletAddress,
                        balance: '0',
                        formatted: '0',
                        symbol: knownToken.symbol,
                        decimals: knownToken.decimals,
                    });
                }
            }
        }
        return results;
    }
    static async getDCATokenBalances(walletAddress) {
        const results = [];
        try {
            const xfiBalance = await this.getTokenBalance(TOKEN_ADDRESSES.XFI, walletAddress);
            results.push(xfiBalance);
        }
        catch (error) {
            console.error('❌ Failed to get XFI balance:', error);
            results.push({
                address: walletAddress,
                balance: '0',
                formatted: '0',
                symbol: 'XFI',
                decimals: 18,
            });
        }
        try {
            const tUSDCBalance = await this.getTokenBalance(TOKEN_ADDRESSES.tUSDC, walletAddress);
            results.push(tUSDCBalance);
        }
        catch (error) {
            console.error('❌ Failed to get tUSDC balance:', error);
            const tUSDCMetadata = TOKEN_METADATA.tUSDC;
            results.push({
                address: walletAddress,
                balance: '0',
                formatted: '0',
                symbol: tUSDCMetadata.symbol,
                decimals: tUSDCMetadata.decimals,
            });
        }
        return results;
    }
    static async hasSufficientBalance(tokenAddress, walletAddress, requiredAmount) {
        try {
            const balance = await this.getTokenBalance(tokenAddress, walletAddress);
            const token = Object.values(TOKEN_METADATA).find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
            const decimals = token?.decimals || 18;
            const requiredAmountBigInt = parseUnits(requiredAmount, decimals);
            const balanceBigInt = BigInt(balance.balance);
            return balanceBigInt >= requiredAmountBigInt;
        }
        catch (error) {
            console.error('Error checking sufficient balance:', error);
            return false;
        }
    }
    static async approveToken(user, tokenAddress, spenderAddress, amount) {
        try {
            if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
                return { success: true };
            }
            const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
            const token = getTokenBySymbol('tUSDC');
            if (!token) {
                throw new Error('Token not found');
            }
            const amountBigInt = parseUnits(amount, token.decimals);
            const hash = await walletClient.writeContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [spenderAddress, amountBigInt],
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            return {
                success: receipt.status === 'success',
                transactionHash: receipt.transactionHash,
            };
        }
        catch (error) {
            console.error('Error approving token:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    static async getTokenAllowance(tokenAddress, ownerAddress, spenderAddress) {
        try {
            if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
                return '0';
            }
            const allowance = await publicClient.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [ownerAddress, spenderAddress],
            });
            return allowance.toString();
        }
        catch (error) {
            console.error('Error getting token allowance:', error);
            throw new Error('Failed to get token allowance');
        }
    }
    static async transferToken(user, tokenAddress, toAddress, amount) {
        try {
            const walletClient = createWalletClientFromPrivateKey(user.encryptedPrivateKey);
            if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
                const hash = await walletClient.sendTransaction({
                    to: toAddress,
                    value: parseUnits(amount, 18),
                });
                const receipt = await publicClient.waitForTransactionReceipt({ hash });
                return {
                    success: receipt.status === 'success',
                    transactionHash: receipt.transactionHash,
                };
            }
            const token = Object.values(TOKEN_METADATA).find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
            if (!token) {
                throw new Error('Token not found');
            }
            const amountBigInt = parseUnits(amount, token.decimals);
            const hash = await walletClient.writeContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [toAddress, amountBigInt],
            });
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            return {
                success: receipt.status === 'success',
                transactionHash: receipt.transactionHash,
            };
        }
        catch (error) {
            console.error('Error transferring token:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    static async getTokenInfo(tokenAddress) {
        try {
            if (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000') {
                return TOKEN_METADATA.XFI;
            }
            const [name, symbol, decimals] = await Promise.all([
                publicClient.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: 'name',
                    args: [],
                }),
                publicClient.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: 'symbol',
                    args: [],
                }),
                publicClient.readContract({
                    address: tokenAddress,
                    abi: ERC20_ABI,
                    functionName: 'decimals',
                    args: [],
                }),
            ]);
            return {
                name,
                symbol,
                decimals,
                address: tokenAddress,
                isNative: false,
            };
        }
        catch (error) {
            console.error('Error getting token info:', error);
            throw new Error('Failed to get token information');
        }
    }
    static formatTokenAmount(amount, decimals, precision = 6) {
        try {
            const formatted = formatUnits(BigInt(amount), decimals);
            const num = parseFloat(formatted);
            if (num === 0)
                return '0';
            if (num < 0.000001)
                return '<0.000001';
            return num.toFixed(precision).replace(/\.?0+$/, '');
        }
        catch (error) {
            console.error('Error formatting token amount:', error);
            return '0';
        }
    }
    static parseTokenAmount(amount, decimals) {
        try {
            return parseUnits(amount, decimals).toString();
        }
        catch (error) {
            console.error('Error parsing token amount:', error);
            throw new Error('Invalid token amount format');
        }
    }
    static async validateSufficientBalance(tokenAddress, walletAddress, amount, includeGas = true) {
        try {
            const balance = await this.getTokenBalance(tokenAddress, walletAddress);
            const token = Object.values(TOKEN_METADATA).find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
            if (!token) {
                throw new Error('Token not found');
            }
            const requiredAmount = parseUnits(amount, token.decimals);
            let totalRequired = requiredAmount;
            if (includeGas && (tokenAddress === TOKEN_ADDRESSES.XFI || tokenAddress === '0x0000000000000000000000000000000000000000')) {
                const gasEstimate = parseUnits('0.001', 18);
                totalRequired += gasEstimate;
            }
            const balanceBigInt = BigInt(balance.balance);
            const sufficient = balanceBigInt >= totalRequired;
            return {
                sufficient,
                balance: balance.formatted,
                required: formatUnits(totalRequired, token.decimals),
                shortfall: sufficient ? undefined : formatUnits(totalRequired - balanceBigInt, token.decimals),
            };
        }
        catch (error) {
            console.error('Error validating sufficient balance:', error);
            throw new Error('Failed to validate balance');
        }
    }
}
//# sourceMappingURL=tokens.js.map