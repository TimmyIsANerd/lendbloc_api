import { type Context, type Next } from 'hono';
import { verify } from 'hono/jwt';
import User, { AccountStatus } from '../models/User';

export const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: 'Missing Token', code: 'MISSING_TOKEN' }, 401);
  }

  const secret = process.env.JWT_SECRET || 'your-secret-key';

  try {
    const decoded: any = await verify(token, secret);

    // Fetch user and ensure account is not blocked
    if (!decoded?.userId) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const user = await User.findById(decoded.userId).select('accountStatus');
    if (!user) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }
    if (user.accountStatus === AccountStatus.BLOCKED) {
      return c.json({ error: 'Account is blocked', code: 'ACCOUNT_BLOCKED' }, 403);
    }

    c.set('jwtPayload', decoded);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid or Expired Token', code: 'INVALID_OR_EXPIRED_TOKEN' }, 401);
  }
};
