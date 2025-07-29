import { setCurrentUserId } from '../tools.js';
export function setUserContext(req, res, next) {
    if (req.user && req.user.id) {
        setCurrentUserId(req.user.id);
    }
    next();
}
//# sourceMappingURL=setUserContext.js.map