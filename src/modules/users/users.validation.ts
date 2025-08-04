import { z } from 'zod';

export const updateUserProfileSchema = z.object({
  title: z.string().optional(),
  fullName: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date of birth must be in DD/MM/YYYY format").optional(),
  phoneNumber: z.string().optional(),
});
