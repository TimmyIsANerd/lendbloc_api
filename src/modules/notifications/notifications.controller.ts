import { type Context } from 'hono';
import { z } from 'zod';
import Notification from '../../models/Notification';
import User from '../../models/User';
import { sendNotificationSchema } from './notifications.validation';
import { sendEmail } from '../../helpers/email';
import { sendSms } from '../../helpers/twilio';

export const sendNotification = async (c: Context) => {
  const { userId, type, message } = c.req.valid('json' as never) as z.infer<
    typeof sendNotificationSchema
  >;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const notification = await Notification.create({
      userId,
      type,
      content: message,
    });

    if (type === 'email') {
      await sendEmail(user.email, 'LendBloc Notification', message);
    } else if (type === 'sms') {
      if (user.phoneNumber) {
        await sendSms(user.phoneNumber, message);
      } else {
        return c.json({ error: 'User does not have a phone number' }, 400);
      }
    }

    return c.json({ message: 'Notification sent successfully', notification });
  } catch (error) {
    console.error('Error sending notification:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};