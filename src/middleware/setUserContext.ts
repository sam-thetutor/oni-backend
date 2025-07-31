import { Response, NextFunction } from 'express';
import { setCurrentUserFrontendWalletAddress } from '../tools.js';
import { AuthenticatedRequest } from './auth.js';

export function setUserContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user && req.user.frontendWalletAddress) {
    setCurrentUserFrontendWalletAddress(req.user.frontendWalletAddress);
  }
  next();
}