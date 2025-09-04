
import { Hono } from 'hono';
import { calculateProfit } from './calculator.controller';

const calculator = new Hono();

calculator.post('/', calculateProfit);

export default calculator;
