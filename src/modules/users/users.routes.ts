import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { 
    getUserProfile, 
    updateUserProfile, 
    requestPasswordChange, 
    validatePasswordChangeOTP, 
    updatePasswordChange,
    requestEmailChange,
    validateEmailChangeOTP,
    updateEmailChange
} from './users.controller';
import { 
    updateUserProfileSchema, 
    requestPasswordChangeSchema, 
    updatePasswordChangeSchema, 
    validatePasswordChangeOTPSchema,
    requestEmailChangeSchema,
    validateEmailChangeOTPSchema,
    updateEmailChangeSchema
} from './users.validation';
import { authMiddleware } from '../../middleware/auth';

const users = new Hono();

users.use('/*', authMiddleware);
users.get('/profile', getUserProfile);
users.put('/profile', zValidator('json', updateUserProfileSchema), updateUserProfile);

users.post("/request-password-change", zValidator('json', requestPasswordChangeSchema), requestPasswordChange);
users.post("/validate-password-change-otp", zValidator('json', validatePasswordChangeOTPSchema), validatePasswordChangeOTP);
users.post("/update-password-change", zValidator('json', updatePasswordChangeSchema), updatePasswordChange);

users.post("/request-email-change", zValidator('json', requestEmailChangeSchema), requestEmailChange);
users.post("/validate-email-change-otp", zValidator('json', validateEmailChangeOTPSchema), validateEmailChangeOTP);
users.post("/update-email-change", zValidator('json', updateEmailChangeSchema), updateEmailChange);

export default users;
