import { type Context } from 'hono';
import { z } from 'zod';
import { chatGetMessagesSchema, chatSendMessageSchema } from './chat.validation';
import AdminChatMessage from '../../models/AdminChatMessage';
import Admin from '../../models/Admin';
import { sendToAdmins } from './wsHub';

const formatTime24 = (date: Date | string | number) => {
  const d = new Date(date);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

export const getMessages = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const me = jwtPayload?.adminId;

  if (!me) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { peerId, page, limit } = c.req.valid('query' as never) as z.infer<typeof chatGetMessagesSchema>;
  const pageNum = page ?? 1;
  const limitNum = limit ?? 20;
  const skip = (pageNum - 1) * limitNum;

  try {
    const [messages, total] = await Promise.all([
      AdminChatMessage.find({
        $or: [
          { senderId: me, recipientId: peerId },
          { senderId: peerId, recipientId: me },
        ],
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate({ path: 'senderId', select: 'fullName avatar' }),
      AdminChatMessage.countDocuments({
        $or: [
          { senderId: me, recipientId: peerId },
          { senderId: peerId, recipientId: me },
        ],
      }),
    ]);

    // Reverse to chronological order
    const ordered = messages.reverse();

    const data = ordered.map((m: any) => ({
      avatar: m.senderId?.avatar ?? null,
      fullName: m.senderId?.fullName ?? 'Unknown Admin',
      time: formatTime24(m.createdAt),
      text: m.text,
    }));

    return c.json({
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const sendMessage = async (c: Context) => {
  const jwtPayload: any = c.get('jwtPayload');
  const me = jwtPayload?.adminId;

  if (!me) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { peerId, text } = c.req.valid('json' as never) as z.infer<typeof chatSendMessageSchema>;

  // Validate peer exists
  const peer = await Admin.findById(peerId).select('_id');
  if (!peer) {
    return c.json({ error: 'Peer admin not found' }, 404);
  }

  try {
    const doc = await AdminChatMessage.create({ senderId: me, recipientId: peerId, text });

    const sender = await Admin.findById(me).select('fullName avatar');

    const payload = {
      avatar: sender?.avatar ?? null,
      fullName: sender?.fullName ?? 'Unknown Admin',
      time: formatTime24(doc.createdAt),
      text: doc.text,
    };

    // Notify both participants if connected
    await sendToAdmins([me, peerId], { type: 'chat_message', data: payload });

    return c.json({ message: 'Message sent' });
  } catch (error) {
    console.error('Error sending message:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

