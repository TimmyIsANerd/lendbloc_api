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
  adminUnblockUser,
  listBlockedUsers,
  listKycUsers,
} from './admin.controller';
import { adminAuthMiddleware } from '../../middleware/adminAuth';

import { adminRegisterSchema, adminSendPhoneOTPSchema, adminVerifyPhoneOTPSchema, adminLoginSchema, adminVerifyLoginSchema, adminLogoutSchema, adminBlockUserSchema, adminUnblockUserSchema, adminListBlockedUsersSchema, adminListKycSchema, adminInviteSchema } from './admin.validation';

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
admin.post('/users/unblock', zValidator('json', adminUnblockUserSchema), adminUnblockUser);
admin.get('/users/blocked', zValidator('query', adminListBlockedUsersSchema), listBlockedUsers);
admin.get('/kyc', zValidator('query', adminListKycSchema), listKycUsers);

// Super Admin only: invite new admins
import { AdminRole } from '../../models/Admin';
admin.post('/invite', adminAuthMiddleware(AdminRole.SUPER_ADMIN), zValidator('json', adminInviteSchema), inviteAdmin);

admin.get('/users', getUsers);
admin.get('/loans', getLoans);
admin.get('/savings', getSavings);
admin.get('/transactions', getTransactions);

export default admin;
