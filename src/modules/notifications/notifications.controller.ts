import { type Context } from 'hono';
import { z } from 'zod';
import Notification from '../../models/Notification';
import { sendNotificationSchema } from './notifications.validation';

export const sendNotification = async (c: Context) => {
  const { userId, type, content } = c.req.valid('json' as never) as z.infer<
    typeof sendNotificationSchema
  >;

  try {
    const notification = await Notification.create({
      userId,
      type,
      content,
    });

    // In a real application, this would involve integrating with email/SMS providers
    console.log(`Sending ${type} notification to user ${userId}: ${content}`);

    return c.json({ message: 'Notification sent successfully', notification });
  } catch (error) {
    console.error('Error sending notification:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};
