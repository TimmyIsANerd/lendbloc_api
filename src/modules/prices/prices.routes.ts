
import { Hono } from 'hono';
import { getPrices, getTopTrends } from './prices.controller';

const prices = new Hono();

prices.get('/', getPrices);
prices.get('/trends', getTopTrends);

export default prices;
