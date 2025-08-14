import { type Context } from 'hono';
import { z } from 'zod';
import User from '../../models/User';
import bcrypt from 'bcrypt';
import { 
  updateUserProfileSchema, 
  requestPasswordChangeSchema, 
  validatePasswordChangeOTPSchema, 
  updatePasswordChangeSchema,
  requestEmailChangeSchema,
  validateEmailChangeOTPSchema,
  updateEmailChangeSchema
} from './users.validation';
import { generateOtp } from '../../helpers/otp/index';
import { sendEmail } from '../../helpers/email/index';
import { passwordResetRequestEmail } from '../../templates/password-reset-request';
import { otpVerificationEmail } from '../../templates/otp-verification';
import Otp from '../../models/Otp';

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

export const requestPasswordChange = async (c: Context) => {
  const { email } = c.req.valid('json' as never) as z.infer<typeof requestPasswordChangeSchema>;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const otp = generateOtp();
    await Otp.create({ userId: user._id, otp });

    await sendEmail(user.email, 'Password Reset', passwordResetRequestEmail(otp, 10));

    return c.json({ message: 'Password reset email sent successfully', userId: user._id });
  } catch (error) {
    console.error('Error requesting password change:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
}

export const validatePasswordChangeOTP = async (c: Context) => {
  const { userId, otp } = c.req.valid('json' as never) as z.infer<typeof validatePasswordChangeOTPSchema>;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const otpRecord = await Otp.findOne({ userId });

    if (!otpRecord) {
      return c.json({ error: 'OTP not found' }, 404);
    }

    if (otpRecord.code !== otp) {
      return c.json({ error: 'Invalid OTP' }, 400);
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ userId });
      return c.json({ error: 'OTP expired' }, 400);
    }

    await Otp.deleteOne({ userId });

    await User.findByIdAndUpdate(userId, { allowPasswordReset: true });

    return c.json({ message: 'OTP validated successfully', userId: user._id });
  } catch (error) {
    console.error('Error validating password change OTP:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
}

export const updatePasswordChange = async (c: Context) => {
  const { userId, password } = c.req.valid('json' as never) as z.infer<typeof updatePasswordChangeSchema>;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (!user.allowPasswordReset) {
      return c.json({ error: 'Password reset is not allowed' }, 400);
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.allowPasswordReset = false;

    await user.save();

    return c.json({ message: 'Password updated successfully', userId: user._id });
  } catch (error) {
    console.error('Error updating password:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
}

export const requestEmailChange = async (c: Context) => {
    const userId = c.get('jwtPayload').userId;
    const { newEmail } = c.req.valid('json' as never) as z.infer<typeof requestEmailChangeSchema>;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const otp = generateOtp();
        await Otp.create({ userId: user._id, otp });

        await sendEmail(newEmail, 'Email Change Verification', otpVerificationEmail(otp, 10));

        return c.json({ message: 'Verification email sent to new address', userId: user._id });
    } catch (error) {
        console.error('Error requesting email change:', error);
        return c.json({ error: 'An unexpected error occurred' }, 500);
    }
}

export const validateEmailChangeOTP = async (c: Context) => {
    const { userId, otp } = c.req.valid('json' as never) as z.infer<typeof validateEmailChangeOTPSchema>;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        const otpRecord = await Otp.findOne({ userId });

        if (!otpRecord) {
            return c.json({ error: 'OTP not found' }, 404);
        }

        if (otpRecord.code !== otp) {
            return c.json({ error: 'Invalid OTP' }, 400);
        }

        if (otpRecord.expiresAt < new Date()) {
            await Otp.deleteOne({ userId });
            return c.json({ error: 'OTP expired' }, 400);
        }

        await Otp.deleteOne({ userId });

        await User.findByIdAndUpdate(userId, { allowEmailChange: true });

        return c.json({ message: 'OTP validated successfully', userId: user._id });
    } catch (error) {
        console.error('Error validating email change OTP:', error);
        return c.json({ error: 'An unexpected error occurred' }, 500);
    }
}

export const updateEmailChange = async (c: Context) => {
    const { userId, newEmail } = c.req.valid('json' as never) as z.infer<typeof updateEmailChangeSchema>;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return c.json({ error: 'User not found' }, 404);
        }

        if (!user.allowEmailChange) {
            return c.json({ error: 'Email change is not allowed' }, 400);
        }

        user.email = newEmail;
        user.allowEmailChange = false;

        await user.save();

        return c.json({ message: 'Email updated successfully', userId: user._id });
    } catch (error) {
        console.error('Error updating email:', error);
        return c.json({ error: 'An unexpected error occurred' }, 500);
    }
}
