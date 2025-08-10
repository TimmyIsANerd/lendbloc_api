import { Hono } from 'hono';
import { shuftiSystems } from './webhooks.controller';

const webhooks = new Hono();


// Handle Callbacks
webhooks.get("/shufti/callback", shuftiSystems);

webhooks.get("/")



export default webhooks;