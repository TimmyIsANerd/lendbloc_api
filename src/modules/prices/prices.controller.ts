
import { Context } from 'hono';

export const getPrices = async (c: Context) => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple,litecoin&vs_currencies=usd');
    const prices = await response.json();
    return c.json(prices);
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
};
