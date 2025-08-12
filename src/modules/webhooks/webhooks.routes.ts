import { Hono } from 'hono';
import { shuftiCallback, shuftiRedirect } from './webhooks.controller';

const webhooks = new Hono();

// Handle Callbacks
webhooks.post("/shufti/callback", shuftiCallback);

webhooks.get("/shufti/redirect", shuftiRedirect);




export default webhooks;