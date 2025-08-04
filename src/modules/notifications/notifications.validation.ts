import { z } from 'zod';
import { NotificationType } from '../../models/Notification';

export const sendNotificationSchema = z.object({
  userId: z.string(),
  type: z.nativeEnum(NotificationType),
  content: z.string(),
});
