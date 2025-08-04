import { type Context } from 'hono';
import { z } from 'zod';
import User from '../../models/User';
import { updateUserProfileSchema } from './users.validation';

export const getUserProfile = async (c: Context) => {
  const userId = c.get('jwtPayload').userId; // Assuming userId is set by a JWT middleware

  try {
    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const updateUserProfile = async (c: Context) => {
  const userId = c.get('jwtPayload').userId; // Assuming userId is set by a JWT middleware
  const { title, fullName, dateOfBirth, phoneNumber } = c.req.valid('json' as never) as z.infer<
    typeof updateUserProfileSchema
  >;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { title, fullName, dateOfBirth, phoneNumber },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};
