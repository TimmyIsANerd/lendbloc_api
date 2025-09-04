
import { Context } from 'hono';

export const calculateProfit = async (c: Context) => {
  try {
    const { amount, referrals } = await c.req.json();

    if (!amount || !referrals) {
      return c.json({ error: 'Amount and referrals are required' }, 400);
    }

    const profit = amount * referrals * 0.1; // 10% profit per referral

    return c.json({ profit });
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
};
