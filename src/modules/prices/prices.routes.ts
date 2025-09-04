
import { Hono } from 'hono';
import { getPrices } from './prices.controller';

const prices = new Hono();

prices.get('/', getPrices);

export default prices;
