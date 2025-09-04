import { type Context, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { AdminRole } from '../models/Admin';

export const adminAuthMiddleware = (requiredRole?: AdminRole) => {
  return async (c: Context, next: Next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return c.json({ error: 'Missing Token', code: 'MISSING_TOKEN' }, 401);
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key';

    try {
      const decoded = await verify(token, secret);
      c.set('jwtPayload', decoded);

      if (requiredRole && decoded.role !== requiredRole) {
        return c.json({ error: 'Forbidden', code: 'FORBIDDEN_ROLE' }, 403);
      }

      await next();
    } catch (error) {
      return c.json({ error: 'Invalid or Expired Token', code: 'INVALID_OR_EXPIRED_TOKEN' }, 401);
    }
  };
};
