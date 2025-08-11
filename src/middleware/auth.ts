import { type Context, type Next } from 'hono';
import { verify } from 'hono/jwt';

export const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: 'Missing Token', code: 'MISSING_TOKEN' }, 401);
  }

  const secret = process.env.JWT_SECRET || 'your-secret-key';

  try {
    const decoded = await verify(token, secret);
    c.set('jwtPayload', decoded);
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid or Expired Token', code: 'INVALID_OR_EXPIRED_TOKEN' }, 401);
  }
};