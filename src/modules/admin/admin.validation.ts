import { z } from 'zod';
import { AdminRole } from '../../models/Admin';

export const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(AdminRole).optional(),
});

export const updateAdminSchema = z.object({
  email: z.string().email().optional(),
  role: z.nativeEnum(AdminRole).optional(),
});

export const loginAdminSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
