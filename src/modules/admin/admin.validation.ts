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