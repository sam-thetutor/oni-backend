import { PrivyService } from '../services/privy.js';
import { WalletService } from '../services/wallet.js';
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                error: 'Access token required',
                message: 'Please authenticate with your wallet'
            });
        }
        try {
            const privyUser = await PrivyService.verifyToken(token);
            if (!privyUser.wallet) {
                return res.status(403).json({
                    error: 'Wallet required',
                    message: 'Wallet connection is required for this operation'
                });
            }
            const dbUser = await WalletService.getUserWallet(privyUser.id, privyUser.wallet.address, privyUser.email);
            req.user = {
                id: privyUser.id,
                walletAddress: dbUser.walletAddress,
                email: privyUser.email,
                dbUser: dbUser,
            };
            next();
        }
        catch (tokenError) {
            console.error('Token verification failed:', tokenError);
            return res.status(401).json({
                error: 'Invalid token',
                message: tokenError instanceof Error ? tokenError.message : 'Authentication token is invalid or expired'
            });
        }
    }
    catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(500).json({
            error: 'Authentication error',
            message: 'Internal server error during authentication'
        });
    }
};
export const requireWalletConnection = (req, res, next) => {
    if (!req.user?.walletAddress) {
        return res.status(403).json({
            error: 'Wallet required',
            message: 'Wallet connection is required for this operation'
        });
    }
    next();
};
export const validateWalletOwnership = (req, res, next) => {
    const { walletAddress } = req.user || {};
    const requestedAddress = req.body.walletAddress || req.params.address;
    if (!walletAddress || !requestedAddress) {
        return res.status(400).json({
            error: 'Wallet address required',
            message: 'Wallet address is required'
        });
    }
    if (walletAddress.toLowerCase() !== requestedAddress.toLowerCase()) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'You can only access your own wallet data'
        });
    }
    next();
};
//# sourceMappingURL=auth.js.map