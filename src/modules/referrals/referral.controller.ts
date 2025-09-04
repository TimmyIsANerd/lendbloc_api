
import { Context } from 'hono';
import Referral from '../../models/Referral';
import User from '../../models/User';
import Earning from '../../models/Earning';
import { sendEmail } from '../../helpers/email';
import { newReferralTemplate } from '../../templates/referral';

export const getReferrals = async (c: Context) => {
  try {
    const { userId } = c.get('jwtPayload');
    const referrals = await Referral.findOne({ user: userId }).populate('referredUsers');
    return c.json(referrals);
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
};

export const getEarnings = async (c: Context) => {
  try {
    const { userId } = c.get('jwtPayload');
    const referral = await Referral.findOne({ user: userId });
    if (!referral) {
      return c.json({ error: 'Referral not found' }, 404);
    }
    const earnings = await Earning.find({ referral: referral._id });
    return c.json(earnings);
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
};

export const sendTestEmail = async (c: Context) => {
  try {
    const { userId } = c.get('jwtPayload');
    const user = await User.findById(userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    await sendEmail(
      user.email,
      'New Referral',
      newReferralTemplate({ fullName: user.fullName, referralFullName: 'John Doe' })
    );

    return c.json({ message: 'Test email sent successfully' });
  } catch (error) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }
};
