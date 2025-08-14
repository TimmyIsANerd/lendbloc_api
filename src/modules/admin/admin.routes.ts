import { Hono } from 'hono';
import {
  getUsers,
  getLoans,
  getSavings,
  getTransactions,
} from './admin.controller';
import { adminAuthMiddleware } from '../../middleware/adminAuth';

const admin = new Hono();

admin.use('/*', adminAuthMiddleware);

admin.get('/users', getUsers);
admin.get('/loans', getLoans);
admin.get('/savings', getSavings);
admin.get('/transactions', getTransactions);

export default admin;