
import { Hono } from 'hono';
import { getDashboard } from './dashboard.controller';
import { jwt } from 'hono/jwt';

const dashboard = new Hono();

dashboard.use('*', jwt({ secret: process.env.JWT_SECRET! }));

dashboard.get('/', getDashboard);

export default dashboard;
