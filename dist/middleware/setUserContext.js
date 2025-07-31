import { setCurrentUserFrontendWalletAddress } from '../tools.js';
export function setUserContext(req, res, next) {
    if (req.user && req.user.frontendWalletAddress) {
        setCurrentUserFrontendWalletAddress(req.user.frontendWalletAddress);
    }
    next();
}
//# sourceMappingURL=setUserContext.js.map