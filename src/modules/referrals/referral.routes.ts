
import { Hono } from 'hono';
import { getReferrals, getEarnings, sendTestEmail } from './referral.controller';
import { bearerAuth } from 'hono/bearer-auth';
import { jwt } from 'hono/jwt';

const referral = new Hono();

referral.use('*', jwt({ secret: process.env.JWT_SECRET! }));

referral.get('/', getReferrals);
referral.get('/earnings', getEarnings);
referral.post('/test-email', sendTestEmail);

export default referral;
