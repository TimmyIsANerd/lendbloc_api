import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { getUserProfile, updateUserProfile } from './users.controller';
import { updateUserProfileSchema } from './users.validation';
import { authMiddleware } from '../../middleware/auth';

const users = new Hono();

users.use('/*', authMiddleware);
users.get('/profile', getUserProfile);
users.put('/profile', zValidator('json', updateUserProfileSchema), updateUserProfile);

export default users;
