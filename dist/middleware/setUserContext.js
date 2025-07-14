import { setCurrentUserId } from '../tools.js';
export function setUserContext(req, res, next) {
    if (req.user && req.user.walletAddress) {
        setCurrentUserId(req.user.walletAddress);
    }
    next();
}
//# sourceMappingURL=setUserContext.js.map