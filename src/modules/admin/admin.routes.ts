import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  adminLogin,
  createAdmin,
  getAllUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  getAllLoans,
  getAllSavingsAccounts,
} from './admin.controller';
import {
  createAdminSchema,
  loginAdminSchema,
  updateAdminSchema,
} from './admin.validation';
import { adminAuthMiddleware } from '../../middleware/adminAuth';

const admin = new Hono();

// Public routes
admin.post('/login', zValidator('json', loginAdminSchema), adminLogin);

// Protected routes
admin.use('/*', adminAuthMiddleware);
admin.post('/admins', zValidator('json', createAdminSchema), createAdmin);
admin.get('/users', getAllUsers);
admin.get('/users/:id', getUserById);
admin.put('/users/:id', zValidator('json', updateAdminSchema), updateUserById);
admin.delete('/users/:id', deleteUserById);
admin.get('/loans', getAllLoans);
admin.get('/savings', getAllSavingsAccounts);

export default admin;
