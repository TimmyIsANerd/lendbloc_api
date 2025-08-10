import { z } from 'zod';

export const sendNotificationSchema = z.object({
  userId: z.string(),
  message: z.string(),
  type: z.enum(['email', 'sms']),
});