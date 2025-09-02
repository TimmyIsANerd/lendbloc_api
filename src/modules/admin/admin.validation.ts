import { z } from 'zod';

export const adminRegisterSchema = z.object({
    role: z.enum(["ADMIN", "SUPER_ADMIN"]),
    fullName: z.string(),
    username: z.string(),
    email: z.email(),
    secondaryEmail: z.string(),
    password: z.string(),
})


export const adminSendPhoneOTPSchema = z.object({
    userId:z.string().regex(/^[0-9a-fA-F]{24}$/),
    phone:z.string().regex(/^\+[1-9]\d{1,14}$/),
})

export const adminVerifyPhoneOTPSchema = z.object({
    userId:z.string().regex(/^[0-9a-fA-F]{24}$/),
    otp:z.string().length(5),
    phone:z.string().regex(/^\+[1-9]\d{1,14}$/),
})

export const adminLoginSchema = z.object({
    email:z.email(),
    password:z.string(),
})

export const adminVerifyLoginSchema = z.object({
    userId:z.string().regex(/^[0-9a-fA-F]{24}$/),
    otp:z.string().length(5),
})

export const adminLogoutSchema = z.object({
    refreshToken: z.string(),
})

export const adminRefreshTokenSchema = z.object({
    refreshToken: z.string(),
})

export const adminBlockUserSchema = z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
}).refine((data) => !!data.email || !!data.phone, {
    message: 'Either email or phone is required',
});

export const adminUnblockUserSchema = z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
}).refine((data) => !!data.email || !!data.phone, {
    message: 'Either email or phone is required',
});

export const adminListBlockedUsersSchema = z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
