// middlewares/adminAuth.js
module.exports = function (req, res, next) {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  
    if (req.user.roles.includes('admin') || req.user.roles.includes('moderator')) {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden: Admins only' });
    }
  };
  // middlewares/adminAuth.js
module.exports = function adminAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  
    const roles = req.user.roles || [];
    if (roles.includes('admin') || roles.includes('moderator')) {
      return next();
    }
  
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  };
  // Protect routes, only admin/moderator allowed
module.exports = function adminAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  
    const roles = req.user.roles || [];
    if (roles.includes('admin') || roles.includes('moderator')) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden: Admins only' });
  };
  