import { z } from 'zod';

export const chatGetMessagesSchema = z.object({
  peerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid admin ID'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const chatSendMessageSchema = z.object({
  peerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid admin ID'),
  text: z.string().min(1).max(5000),
});

