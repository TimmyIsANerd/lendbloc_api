import { Hono } from 'hono';
import { shuftiCallback, shuftiRedirect, tatumCallback } from './webhooks.controller';

const webhooks = new Hono();

// Handle Callbacks
webhooks.post("/shufti/callback", shuftiCallback);

webhooks.get("/shufti/redirect", shuftiRedirect);

webhooks.post('/tatum', tatumCallback);


export default webhooks;