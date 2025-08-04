import { type Context } from 'hono';
import { z } from 'zod';
import Admin, { AdminRole } from '../../models/Admin';
import User from '../../models/User';
import Loan from '../../models/Loan';
import SavingsAccount from '../../models/SavingsAccount';
import bcrypt from 'bcrypt';
import { sign } from 'hono/jwt';
import { createAdminSchema, updateAdminSchema, loginAdminSchema } from './admin.validation';

export const adminLogin = async (c: Context) => {
  const { email, password } = c.req.valid('json' as never) as z.infer<
    typeof loginAdminSchema
  >;

  try {
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);

    if (!passwordMatch) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const token = await sign({ adminId: admin._id, role: admin.role }, secret);

    return c.json({ message: 'Login successful', token }, 200);
  } catch (error) {
    console.error('Error during admin login:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const createAdmin = async (c: Context) => {
  const { email, password, role } = c.req.valid('json' as never) as z.infer<
    typeof createAdminSchema
  >;

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      return c.json({ error: 'Admin with this email already exists' }, 409);
    }

    const admin = await Admin.create({
      email,
      passwordHash,
      role: role || AdminRole.ADMIN,
    });

    return c.json({ message: 'Admin created successfully', adminId: admin._id });
  } catch (error) {
    console.error('Error creating admin:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const getAllUsers = async (c: Context) => {
  try {
    const users = await User.find({}).select('-passwordHash');
    return c.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const getUserById = async (c: Context) => {
  const userId = c.req.param('id');

  try {
    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const updateUserById = async (c: Context) => {
  const userId = c.req.param('id');
  const { title, fullName, dateOfBirth, phoneNumber, isKycVerified } = c.req.valid('json' as never) as z.infer<
    typeof updateAdminSchema
  >;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { title, fullName, dateOfBirth, phoneNumber, isKycVerified },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Error updating user:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const deleteUserById = async (c: Context) => {
  const userId = c.req.param('id');

  try {
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const getAllLoans = async (c: Context) => {
  try {
    const loans = await Loan.find({}).populate('userId').populate('collateralAssetId').populate('loanAssetId');
    return c.json(loans);
  } catch (error) {
    console.error('Error fetching all loans:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const getAllSavingsAccounts = async (c: Context) => {
  try {
    const savingsAccounts = await SavingsAccount.find({}).populate('userId').populate('assetId');
    return c.json(savingsAccounts);
  } catch (error) {
    console.error('Error fetching all savings accounts:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};
