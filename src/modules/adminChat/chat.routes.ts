import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { chatGetMessagesSchema, chatSendMessageSchema } from './chat.validation';
import { getMessages, sendMessage } from './chat.controller';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { chatWebSocketHandler } from './wsHub';

export const adminChat = new Hono();

// Protect all chat routes with admin auth
adminChat.use('/*', adminAuthMiddleware());

// REST endpoints
adminChat.get('/messages', zValidator('query', chatGetMessagesSchema), getMessages);
adminChat.post('/messages', zValidator('json', chatSendMessageSchema), sendMessage);

// WebSocket endpoint
adminChat.get('/ws', chatWebSocketHandler);

