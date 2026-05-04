import User from '../models/User.js';
import { verifyAuthToken } from '../utils/auth.js';

export default async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication token is required' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token is required' });
  }

  try {
    const decoded = verifyAuthToken(token);
    const user = await User.findById(decoded.sub);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Session is no longer valid' });
    }

    req.user = user;
    req.userId = user._id.toString();
    req.token = token;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}
