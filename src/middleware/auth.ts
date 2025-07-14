import { Request, Response, NextFunction } from 'express';
import { PrivyService, PrivyUser } from '../services/privy.js';
import { WalletService } from '../services/wallet.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    walletAddress: string;
    email?: string;
    dbUser?: any; // User document from database
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        message: 'Please authenticate with your wallet' 
      });
    }

    try {
      // Verify the Privy token and get user information
      const privyUser: PrivyUser = await PrivyService.verifyToken(token);
      
      // Validate that user has a connected wallet
      if (!privyUser.wallet) {
        return res.status(403).json({ 
          error: 'Wallet required',
          message: 'Wallet connection is required for this operation' 
        });
      }

      // Get or create user wallet in our database using Privy ID and frontend wallet address
      const dbUser = await WalletService.getUserWallet(privyUser.id, privyUser.wallet.address, privyUser.email);

      // Add user info to request - use frontend wallet address for context
      req.user = {
        id: privyUser.id,
        walletAddress: dbUser.walletAddress, // the wallet address that was generated on the backend,
        email: privyUser.email,
        dbUser: dbUser, // Store the full user document
      };

      console.log('Authenticated user:', {
        privyId: req.user.id,
        privyWalletAddress: privyUser.wallet.address, // Privy wallet
        walletAddress: req.user.dbUser.walletAddress, // Our database wallet
        email: req.user.email,
        dbUserExists: !!req.user.dbUser,
        dbUser: req.user.dbUser,
      });

      next();
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      return res.status(401).json({ 
        error: 'Invalid token',
        message: tokenError instanceof Error ? tokenError.message : 'Authentication token is invalid or expired' 
      });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Internal server error during authentication' 
    });
  }
};

export const requireWalletConnection = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.walletAddress) {
    return res.status(403).json({ 
      error: 'Wallet required',
      message: 'Wallet connection is required for this operation' 
    });
  }
  next();
};

export const validateWalletOwnership = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const { walletAddress } = req.user || {};
  const requestedAddress = req.body.walletAddress || req.params.address;

  if (!walletAddress || !requestedAddress) {
    return res.status(400).json({ 
      error: 'Wallet address required',
      message: 'Wallet address is required' 
    });
  }

  // Ensure user can only access their own wallet data
  if (walletAddress.toLowerCase() !== requestedAddress.toLowerCase()) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'You can only access your own wallet data' 
    });
  }

  next();
}; 