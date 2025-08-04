import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import {
  sendNotification,
} from './notifications.controller';
import {
  sendNotificationSchema,
} from './notifications.validation';

const notifications = new Hono();

notifications.use('/*', authMiddleware);
notifications.post('/', zValidator('json', sendNotificationSchema), sendNotification);

export default notifications;
