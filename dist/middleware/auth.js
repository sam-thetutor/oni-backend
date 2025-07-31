import { PrivyService } from '../services/privy.js';
import { MongoDBService } from '../services/mongodb.js';
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            console.log('❌ No authorization token provided');
            return res.status(401).json({
                error: 'Access token required',
                message: 'Please authenticate with your wallet'
            });
        }
        console.log('🔐 Processing authentication request...');
        try {
            const privyUser = await PrivyService.verifyToken(token);
            console.log('✅ Privy token verified successfully');
            if (!privyUser.wallet) {
                console.log('❌ User does not have a connected wallet');
                return res.status(403).json({
                    error: 'Wallet required',
                    message: 'Wallet connection is required for this operation. Please connect your wallet and try again.'
                });
            }
            console.log('👛 User wallet found:', privyUser.wallet.address);
            try {
                const dbUser = await MongoDBService.getUserWallet(privyUser.wallet.address, privyUser.email);
                console.log('💾 Database user retrieved/created successfully');
                req.user = {
                    frontendWalletAddress: privyUser.wallet.address,
                    walletAddress: dbUser.walletAddress,
                    email: privyUser.email,
                    dbUser: dbUser,
                };
                console.log('✅ Authentication completed successfully');
                next();
            }
            catch (dbError) {
                console.error('❌ Database error during authentication:', dbError);
                return res.status(500).json({
                    error: 'Database error',
                    message: 'Failed to retrieve user data. Please try again.'
                });
            }
        }
        catch (tokenError) {
            console.error('❌ Token verification failed:', tokenError);
            let errorMessage = 'Authentication token is invalid or expired';
            let statusCode = 401;
            if (tokenError instanceof Error) {
                errorMessage = tokenError.message;
                if (errorMessage.includes('expired') || errorMessage.includes('reconnect')) {
                    statusCode = 401;
                }
                else if (errorMessage.includes('Wallet connection is required')) {
                    statusCode = 403;
                }
            }
            return res.status(statusCode).json({
                error: statusCode === 401 ? 'Invalid token' : 'Authentication error',
                message: errorMessage,
                requiresReauth: statusCode === 401
            });
        }
    }
    catch (error) {
        console.error('❌ Authentication middleware error:', error);
        return res.status(500).json({
            error: 'Authentication error',
            message: 'Internal server error during authentication. Please try again.'
        });
    }
};
export const requireWalletConnection = (req, res, next) => {
    if (!req.user?.walletAddress) {
        console.log('❌ Wallet connection required but not found');
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
        console.log('❌ Wallet address validation failed - missing addresses');
        return res.status(400).json({
            error: 'Wallet address required',
            message: 'Wallet address is required'
        });
    }
    if (walletAddress.toLowerCase() !== requestedAddress.toLowerCase()) {
        console.log('❌ Wallet ownership validation failed:', {
            userWallet: walletAddress,
            requestedAddress: requestedAddress
        });
        return res.status(403).json({
            error: 'Access denied',
            message: 'You can only access your own wallet data'
        });
    }
    console.log('✅ Wallet ownership validated');
    next();
};
//# sourceMappingURL=auth.js.map