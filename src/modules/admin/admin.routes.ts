import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  getUsers,
  getLoans,
  getSavings,
  getTransactions,
  adminRegister,
  adminSendPhoneOtp,
  adminVerifyPhoneOtp,
  adminLogin,
  adminVerifyLogin,
  adminLogout,
  getAdminProfile,
  uploadAdminAvatar,
  deleteAdminAvatar,
  adminBlockUser,
} from './admin.controller';
import { adminAuthMiddleware } from '../../middleware/adminAuth';

import { adminRegisterSchema, adminSendPhoneOTPSchema, adminVerifyPhoneOTPSchema, adminLoginSchema, adminVerifyLoginSchema, adminLogoutSchema, adminBlockUserSchema } from './admin.validation';

export const adminRouter = new Hono();

adminRouter.post('/register', zValidator('json', adminRegisterSchema), adminRegister);
adminRouter.post('/send-phone-otp', zValidator('json', adminSendPhoneOTPSchema), adminSendPhoneOtp);
adminRouter.post('/verify-phone-otp', zValidator('json', adminVerifyPhoneOTPSchema), adminVerifyPhoneOtp);
adminRouter.post('/login', zValidator('json', adminLoginSchema), adminLogin);
adminRouter.post('/verify-login', zValidator('json', adminVerifyLoginSchema), adminVerifyLogin);
adminRouter.post('/logout', zValidator('json', adminLogoutSchema), adminLogout);

const admin = new Hono();

admin.use('/*', adminAuthMiddleware());

admin.get('/profile', getAdminProfile);
admin.put('/profile/avatar', uploadAdminAvatar);
admin.delete('/profile/avatar', deleteAdminAvatar);

admin.post('/users/block', zValidator('json', adminBlockUserSchema), adminBlockUser);

admin.get('/users', getUsers);
admin.get('/loans', getLoans);
admin.get('/savings', getSavings);
admin.get('/transactions', getTransactions);

export default admin;
