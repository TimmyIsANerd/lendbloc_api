import { type Context } from 'hono';
import mongoose from 'mongoose';
import { z } from 'zod';
import Asset from '../../models/Asset';
import Loan from '../../models/Loan';
import LoanQuote from '../../models/LoanQuote';
import Wallet from '../../models/Wallet';
import UserBalance from '../../models/UserBalance';
import Transaction from '../../models/Transaction';
import { termKeyFromDays } from '../../helpers/assets/terms';
import User, { AccountType } from '../../models/User';
import { zValidator } from '@hono/zod-validator';
import { ordinalDate, resolveUsdPrices, resolveLiquidityTokens, computeRequiredCollateralTokens, computeExposureAndThresholds, nextMonthlyInterestDate } from './lending.utils';
import { quoteLoanSchema, createLoanFromQuoteSchema, loanIdParamSchema } from './lending.new.validation';
import { createEvmWalletWithViem } from '../../helpers/wallet/evm';
import { generateTronWallet } from '../../helpers/wallet/non-evm';
import { encryptMnemonic } from '../../helpers/wallet/security';
import { sendFromLiquidityWallet } from '../../utils/funds';

const IS_DEV = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';
const ORIG_FEE = Number(process.env.ORIGINATION_FEE ?? 20);
const MC_LTV = Number(process.env.MARGIN_CALL_LTV ?? 0.7);
const LQ_LTV = Number(process.env.LIQUIDATION_LTV ?? 0.8);
const COLLATERAL_TIMEOUT_MINUTES = Number(process.env.COLLATERAL_TIMEOUT_MINUTES ?? 20);

function getMonthlyInterestPercentForBorrowAsset(asset: any, accountType: AccountType): number {
  // Use d30 for monthly rate
  const loanInterest = asset?.fees?.loanInterest;
  const obj = accountType === AccountType.PRO ? loanInterest?.PRO : loanInterest?.REG;
  const rate = obj?.d30 ?? 0;
  return Number(rate) || 0;
}

export const quoteLoan = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { borrowSymbol, borrowNetwork, borrowAmount, collateralSymbol } = c.req.valid('json' as never) as z.infer<typeof quoteLoanSchema>;

  try {
    const [borrowAsset, collateralAsset, user] = await Promise.all([
      Asset.findOne({ symbol: borrowSymbol.toUpperCase(), status: 'LISTED' }),
      Asset.findOne({ symbol: collateralSymbol.toUpperCase(), status: 'LISTED' }),
      User.findById(userId).select('accountType'),
    ]);

    if (!borrowAsset || !collateralAsset) {
      return c.json({ error: 'Invalid borrow or collateral asset' }, 400);
    }

    // Restrict borrow network to ETH or TRON as requested
    if (!['ETH', 'TRON'].includes(borrowNetwork)) {
      return c.json({ error: 'Unsupported borrow network' }, 400);
    }

    // Pricing
    const { borrowUsd, collateralUsd } = await resolveUsdPrices(borrowAsset, collateralAsset);

    // LTV target
    const targetLtvLoanToCollateral = 0.5;

    // Required collateral (tokens)
    const requiredCollateralTokens = computeRequiredCollateralTokens(borrowAmount, targetLtvLoanToCollateral, collateralUsd, borrowUsd);

    // Exposure and thresholds
    const exposure = computeExposureAndThresholds({
      borrowAmount,
      borrowUsd,
      collateralUsd,
      requiredCollateralTokens,
      marginCallLtv: MC_LTV,
      liquidationLtv: LQ_LTV,
    });

    // Interest rate and amounts
    const acct = user?.accountType || AccountType.REG;
    const monthlyRate = getMonthlyInterestPercentForBorrowAsset(borrowAsset, acct);
    const monthlyInterestAmountToken = borrowAmount * (monthlyRate / 100);
    const nextInterestAt = nextMonthlyInterestDate();

    // Origination fee
    const originationFeePercent = ORIG_FEE;
    const originationFeeAmountToken = borrowAmount * (originationFeePercent / 100);

    // Liquidity check (borrow asset on desired network)
    const liquidityTokens = await resolveLiquidityTokens(borrowAsset.symbol, borrowNetwork);
    if ((liquidityTokens || 0) < borrowAmount) {
      return c.json({ error: 'Insufficient liquidity for requested borrow amount' }, 400);
    }

    // Persist quote
    const quote = await LoanQuote.create({
      userId,
      borrowSymbol: borrowAsset.symbol,
      borrowAssetId: borrowAsset._id,
      borrowNetwork: borrowNetwork as any,
      borrowAmount,
      collateralSymbol: collateralAsset.symbol,
      collateralAssetId: collateralAsset._id,
      targetLtvLoanToCollateral,
      unitPricesUsd: { borrowUsd, collateralUsd },
      valuesUsd: { borrowUsd: borrowAmount * borrowUsd, collateralUsd: requiredCollateralTokens * collateralUsd },
      requiredCollateralAmountToken: requiredCollateralTokens,
      marginCallLtv: MC_LTV,
      liquidationLtv: LQ_LTV,
      marginCallCollateralValueUsd: exposure.marginCallCollateralValueUsd,
      liquidationCollateralValueUsd: exposure.liquidationCollateralValueUsd,
      interestMonthlyPercent: monthlyRate,
      interestMonthlyAmountToken: monthlyInterestAmountToken,
      nextInterestAt,
      originationFeePercent,
      originationFeeAmountToken,
      exposure: {
        equityUsd: exposure.equityUsd,
        distanceToMarginCallPercent: exposure.distanceToMarginCallPercent,
        marginCallPrice: exposure.marginCallPrice,
        liquidationPrice: exposure.liquidationPrice,
      },
      status: 'ACTIVE',
    });

    // LTVs in both conventions for clarity
    const loanUsd = borrowAmount * borrowUsd;
    const collateralUsdValue = requiredCollateralTokens * collateralUsd;
    const ltvLoanToCollateral = collateralUsdValue > 0 ? (loanUsd / collateralUsdValue) : 0; // e.g., 0.5 means 50%
    const ltvCollateralToLoan = loanUsd > 0 ? (collateralUsdValue / loanUsd) : 0; // e.g., 2.0 means 200%

    return c.json({
      quoteId: String(quote._id),
      borrow: {
        symbol: borrowAsset.symbol,
        network: borrowNetwork,
        amount: borrowAmount,
        unitPriceUsd: borrowUsd,
        valueUsd: loanUsd,
      },
      collateral: {
        symbol: collateralAsset.symbol,
        unitPriceUsd: collateralUsd,
        requiredAmount: requiredCollateralTokens,
        valueUsd: collateralUsdValue,
      },
      ltv: {
        loanToCollateral: ltvLoanToCollateral, // best-practice primary (e.g., 0.5 => 50%)
        collateralToLoan: ltvCollateralToLoan, // per your note (e.g., 2.0 => 200%)
      },
      interest: {
        monthlyPercent: monthlyRate,
        monthlyAmountToken: monthlyInterestAmountToken,
        nextChargeDate: ordinalDate(nextInterestAt),
      },
      fees: {
        originationFeePercent,
        originationFeeAmountToken,
      },
      exposure: quote.exposure,
      margin: {
        marginCallLtv: MC_LTV,
        liquidationLtv: LQ_LTV,
      },
      createdAt: quote.createdAt,
    });
  } catch (error) {
    console.error('Error generating loan quote:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

async function generateCollateralWalletForSymbol(userId: string, collateralAsset: any, loanId: string) {
  const symbol = collateralAsset.symbol.toUpperCase();
  if (symbol === 'ETH') {
    const w = createEvmWalletWithViem();
    const enc = encryptMnemonic(w.mnemonic);
    const wallet = await Wallet.create({ userId, assetId: collateralAsset._id, address: w.address, encryptedMnemonic: enc, network: 'ETH', balance: 0, isLoanCollateral: true, loanId });
    return wallet;
  }
  if (symbol === 'TRX' || symbol === 'TRON') {
    const w = await generateTronWallet();
    const enc = encryptMnemonic(w.mnemonic);
    const wallet = await Wallet.create({ userId, assetId: collateralAsset._id, address: w.address, encryptedMnemonic: enc, network: 'TRON', balance: 0, isLoanCollateral: true, loanId });
    return wallet;
  }
  if (symbol === 'BTC') {
    // Collateral acceptance per your spec is ETH/BTC/TRON/LTC. Wallet gen exists for BTC/LTC but we only allow borrowNetwork ETH/TRON.
    const { generateBtcWallet } = await import('../../helpers/wallet/non-evm');
    const w = await generateBtcWallet();
    const enc = encryptMnemonic(w.mnemonic);
    const wallet = await Wallet.create({ userId, assetId: collateralAsset._id, address: w.address, encryptedMnemonic: enc, network: 'BTC', balance: 0, isLoanCollateral: true, loanId });
    return wallet;
  }
  if (symbol === 'LTC') {
    const { generateLTCWallet } = await import('../../helpers/wallet/non-evm');
    const w = await generateLTCWallet();
    const enc = encryptMnemonic(w.mnemonic);
    const wallet = await Wallet.create({ userId, assetId: collateralAsset._id, address: w.address, encryptedMnemonic: enc, network: 'LTC', balance: 0, isLoanCollateral: true, loanId });
    return wallet;
  }
  throw new Error('Unsupported collateral symbol');
}

async function sendBorrowToPayout({ userId, loan, borrowAsset }: { userId: string; loan: any; borrowAsset: any }) {
  if (loan.payoutMethod === 'INTERNAL') {
    // Credit user balance in borrow asset
    await UserBalance.findOneAndUpdate(
      { userId, assetId: borrowAsset._id },
      { $inc: { balance: loan.loanAmount } },
      { upsert: true, new: true }
    );
    await Transaction.create({ user: userId as any, type: 'loan-disbursement', amount: loan.loanAmount, asset: borrowAsset.symbol, status: 'completed', loanId: loan._id });
    return { ok: true };
  }
  // External payout
  if (IS_DEV) {
    await Transaction.create({ user: userId as any, type: 'loan-disbursement', amount: loan.loanAmount, asset: borrowAsset.symbol, status: 'completed', loanId: loan._id });
    return { ok: true };
  }
  // Production: send from liquidity wallet on the chosen network
  try {
    const { txHash } = await sendFromLiquidityWallet({ asset: borrowAsset, to: String(loan.payoutAddress || ''), amountToken: loan.loanAmount });
    await Transaction.create({ user: userId as any, type: 'loan-disbursement', amount: loan.loanAmount, asset: borrowAsset.symbol, status: 'completed', loanId: loan._id, txHash });
  } catch (e) {
    console.error('External payout failed:', e);
    await Transaction.create({ user: userId as any, type: 'loan-disbursement', amount: loan.loanAmount, asset: borrowAsset.symbol, status: 'failed', loanId: loan._id });
    throw e;
  }
  return { ok: true };
}

export const createLoanFromQuote = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { quoteId, payoutMethod, payoutAddress, simulate } = c.req.valid('json' as never) as z.infer<typeof createLoanFromQuoteSchema>;

  try {
    const quote = await LoanQuote.findOne({ _id: quoteId, userId, status: 'ACTIVE' });
    if (!quote) return c.json({ error: 'Quote not found or already used' }, 404);

    // Lock quote
    quote.status = 'USED';
    await quote.save();

    const [borrowAsset, collateralAsset] = await Promise.all([
      Asset.findById(quote.borrowAssetId),
      Asset.findById(quote.collateralAssetId),
    ]);
    if (!borrowAsset || !collateralAsset) return c.json({ error: 'Assets not found' }, 400);

    // Create Loan in PENDING_COLLATERAL
    const now = new Date();
    const expiresAt = new Date(now.getTime() + COLLATERAL_TIMEOUT_MINUTES * 60 * 1000);

    const loan = await Loan.create({
      userId,
      loanAssetId: borrowAsset._id,
      loanAmount: quote.borrowAmount,
      borrowNetwork: quote.borrowNetwork,
      interestRate: quote.interestMonthlyPercent,
      nextInterestAt: quote.nextInterestAt,
      collateralAssetId: collateralAsset._id,
      expectedCollateralAmountToken: quote.requiredCollateralAmountToken,
      collateralReceivedAmountToken: 0,
      targetLtvLoanToCollateral: quote.targetLtvLoanToCollateral,
      marginCallLtv: quote.marginCallLtv,
      liquidationLtv: quote.liquidationLtv,
      unitPricesAtOrigination: { borrowUsd: quote.unitPricesUsd.borrowUsd, collateralUsd: quote.unitPricesUsd.collateralUsd },
      valuesAtOrigination: { borrowUsd: quote.valuesUsd.borrowUsd, collateralUsd: quote.valuesUsd.collateralUsd },
      originationFeePercent: quote.originationFeePercent,
      originationFeeAmountToken: quote.originationFeeAmountToken,
      payoutMethod,
      payoutAddress,
      quoteId: quote._id,
      status: 'PENDING_COLLATERAL',
      expiresAt,
    });

    // Generate collateral receiving wallet and attach
    const colWallet = await generateCollateralWalletForSymbol(userId, collateralAsset, String(loan._id));
    loan.collateralWalletId = colWallet._id as any;
    loan.collateralReceivingAddress = colWallet.address;
    await loan.save();

    // DEV simulate: mark collateral received and disburse immediately
    if (IS_DEV && simulate) {
      loan.collateralReceivedAmountToken = quote.requiredCollateralAmountToken;
      loan.status = 'ACTIVE';
      loan.disbursedAt = new Date();
      await loan.save();
      await sendBorrowToPayout({ userId, loan, borrowAsset });
    }

    return c.json({
      message: 'Loan created. Send collateral to the receiving address.',
      loanId: String(loan._id),
      collateralReceivingAddress: colWallet.address,
      expiresAt: loan.expiresAt,
      status: loan.status,
    });
  } catch (error) {
    console.error('Error creating loan from quote:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

async function selectBorrowAssetFields(assetId: any) {
  return Asset.findById(assetId).select('symbol network currentPrice kind tokenAddress decimals');
}

function extractOriginationUsdPrice(loan: any): number {
  return Number(loan?.unitPricesAtOrigination?.borrowUsd ?? 0) || 0;
}

import { getUsdPrice } from '../../services/pricing';

async function computeCurrentUsdPriceForAsset(asset: any): Promise<number> {
  // Delegates to pricing service (Tatum in non-dev, fallback to DB value)
  return await getUsdPrice(String(asset?.network || ''), String(asset?.symbol || ''), Number(asset?.currentPrice ?? 0));
}

async function withRatesAsync(loan: any, borrowAsset: any) {
  const currentUsd = await computeCurrentUsdPriceForAsset(borrowAsset);
  const originationUsd = extractOriginationUsdPrice(loan);
  return {
    ...loan,
    rates: {
      // As requested: current rate (1 unit -> USD now) and "margin call" (USD at origination)
      current: currentUsd,
      marginCall: originationUsd,
    },
  };
}

export const getLoan = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id } = c.req.valid('param' as never) as z.infer<typeof loanIdParamSchema>;
  const loan = await Loan.findOne({ _id: id, userId }).lean();
  if (!loan) return c.json({ error: 'Loan not found' }, 404);
const borrowAsset = await selectBorrowAssetFields(loan.loanAssetId);
  return c.json(await withRatesAsync(loan, borrowAsset));
};

export const listLoans = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { status, page, limit } = c.req.valid('query' as never) as z.infer<typeof import('./lending.new.validation').listLoansQuerySchema>;

  const q: any = { userId };
  if (status) q.status = status;

  const [items, total] = await Promise.all([
    Loan.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Loan.countDocuments(q),
  ]);

  // Prefetch borrow assets for all loans
  const assetIds = Array.from(new Set(items.map((l: any) => String(l.loanAssetId))));
  const assets = await Asset.find({ _id: { $in: assetIds } }).select('symbol network currentPrice kind tokenAddress decimals').lean();
  const assetMap = new Map(assets.map((a: any) => [String(a._id), a]));

// Enrich with rates (in parallel)
  const enriched = await Promise.all(items.map(async (l: any) => {
    const a = assetMap.get(String(l.loanAssetId));
    return await withRatesAsync(l, a);
  }));

return c.json({ items: enriched, page, limit, total });
};

// --- New: Increase Collateral ---
export const increaseCollateral = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id } = c.req.valid('param' as never) as z.infer<typeof loanIdParamSchema>;
  const { method, amountToken, txHash } = c.req.valid('json' as never) as z.infer<typeof import('./lending.new.validation').increaseCollateralSchema>;

  const IS_DEV = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

  try {
    const loan = await Loan.findOne({ _id: id, userId });
    if (!loan) return c.json({ error: 'Loan not found' }, 404);

    const collateralAsset = await Asset.findById(loan.collateralAssetId);
    if (!collateralAsset) return c.json({ error: 'Collateral asset not found' }, 400);

    if (method === 'INTERNAL') {
      const amt = Number(amountToken || 0);
      if (!(amt > 0)) return c.json({ error: 'amountToken required for INTERNAL method' }, 400);

      const UB = (await import('../../models/UserBalance')).default;
      const bal = await UB.findOne({ userId, assetId: collateralAsset._id });
      if (!bal || (Number(bal.balance) || 0) < amt) return c.json({ error: 'Insufficient collateral balance' }, 400);

      await UB.updateOne({ _id: bal._id }, { $inc: { balance: -amt } });

      loan.collateralReceivedAmountToken = (loan.collateralReceivedAmountToken || 0) + amt;
      await loan.save();

      await Transaction.create({ user: userId as any, type: 'deposit', amount: amt, asset: collateralAsset.symbol, status: 'confirmed', loanId: loan._id });

      if (!IS_DEV) {
        try {
          // Move funds to liquidity wallet
          if (collateralAsset.kind === 'erc20') {
            await relocateFundsToLiquidityWallet(String(loan.collateralWalletId || ''), { amount: amt, kind: 'erc20', tokenAddress: String(collateralAsset.tokenAddress || ''), decimals: collateralAsset.decimals });
          } else if (collateralAsset.kind === 'trc20') {
            await relocateFundsToLiquidityWallet(String(loan.collateralWalletId || ''), { amount: amt, kind: 'trc20', tokenAddress: String(collateralAsset.tokenAddress || ''), decimals: collateralAsset.decimals });
          } else {
            await relocateFundsToLiquidityWallet(String(loan.collateralWalletId || ''), amt);
          }
        } catch (e) {
          console.error('Relocation after collateral increase failed:', e);
        }
      }

      const borrowAsset = await Asset.findById(loan.loanAssetId);
      return c.json(await withRatesAsync(loan.toJSON(), borrowAsset));
    }

    // EXTERNAL
    if (IS_DEV) {
      const amt = Number(amountToken || 0);
      if (!(amt > 0)) return c.json({ error: 'amountToken required for EXTERNAL in development' }, 400);
      loan.collateralReceivedAmountToken = (loan.collateralReceivedAmountToken || 0) + amt;
      await loan.save();
      await Transaction.create({ user: userId as any, type: 'deposit', amount: amt, asset: collateralAsset.symbol, status: 'confirmed', loanId: loan._id });
      const borrowAsset = await Asset.findById(loan.loanAssetId);
      return c.json(await withRatesAsync(loan.toJSON(), borrowAsset));
    } else {
      if (!txHash) return c.json({ error: 'txHash required for EXTERNAL in production' }, 400);
      await Transaction.create({ user: userId as any, type: 'deposit', amount: 0, asset: collateralAsset.symbol, status: 'pending', txHash, loanId: loan._id });
      return c.json({ message: 'Collateral top-up pending confirmation', loanId: String(loan._id) });
    }
  } catch (error) {
    console.error('Increase collateral error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

// --- New: Repay with OTP (two-step) ---
export const repayRequestOtp = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id } = c.req.valid('param' as never) as z.infer<typeof loanIdParamSchema>;
  const { method, amountToken } = c.req.valid('json' as never) as z.infer<typeof import('./lending.new.validation').repayRequestOtpSchema>;

  const IS_DEV = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

  try {
    const loan = await Loan.findOne({ _id: id, userId, status: 'ACTIVE' });
    if (!loan) return c.json({ error: 'Active loan not found' }, 404);
    if (!(Number(amountToken) > 0)) return c.json({ error: 'amountToken must be positive' }, 400);

    if (IS_DEV) {
      return c.json({ message: 'OTP not required in development', dev: true });
    }

    const user = await (await import('../../models/User')).default.findById(userId).select('phoneNumber');
    if (!user?.phoneNumber) return c.json({ error: 'User phone number not found' }, 400);

    const { generateOtp } = await import('../../helpers/otp');
    const code = generateOtp(6);
    const OtpModel = (await import('../../models/Otp')).default;
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await OtpModel.findOneAndUpdate({ userId }, { code, expiresAt: expires, createdAt: new Date() }, { upsert: true, new: true });

    try {
      const { sendSms } = await import('../../helpers/twilio');
      await sendSms(user.phoneNumber, `Your repayment OTP is ${code}. It expires in 5 minutes.`);
    } catch (e) {
      console.error('Failed to send OTP SMS:', e);
      return c.json({ error: 'Failed to send OTP' }, 500);
    }

    return c.json({ message: 'OTP sent via SMS' });
  } catch (error) {
    console.error('Repay OTP request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const repayConfirm = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id } = c.req.valid('param' as never) as z.infer<typeof loanIdParamSchema>;
  const { method, amountToken, otpCode, txHash } = c.req.valid('json' as never) as z.infer<typeof import('./lending.new.validation').repayConfirmSchema>;

  const IS_DEV = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

  try {
    const loan = await Loan.findOne({ _id: id, userId, status: 'ACTIVE' });
    if (!loan) return c.json({ error: 'Active loan not found' }, 404);

    const borrowAsset = await Asset.findById(loan.loanAssetId);
    if (!borrowAsset) return c.json({ error: 'Borrow asset not found' }, 400);

    // OTP validation in PROD only
    if (!IS_DEV) {
      const OtpModel = (await import('../../models/Otp')).default;
      const rec = await OtpModel.findOne({ userId });
      if (!rec || !otpCode || rec.code !== otpCode || (rec.expiresAt && rec.expiresAt < new Date())) {
        return c.json({ error: 'Invalid or expired OTP' }, 401);
      }
      await OtpModel.deleteOne({ userId });
    }

    const repayAmt = Math.min(Number(amountToken || 0), Number(loan.loanAmount || 0));
    if (!(repayAmt > 0)) return c.json({ error: 'Invalid repayment amount' }, 400);

    if (method === 'INTERNAL') {
      const UB = (await import('../../models/UserBalance')).default;
      const bal = await UB.findOne({ userId, assetId: borrowAsset._id });
      if (!bal || (Number(bal.balance) || 0) < repayAmt) return c.json({ error: 'Insufficient balance' }, 400);

      await UB.updateOne({ _id: bal._id }, { $inc: { balance: -repayAmt } });
      loan.loanAmount = Number(loan.loanAmount || 0) - repayAmt;

      if (loan.loanAmount <= 0) {
        loan.loanAmount = 0;
        loan.status = 'REPAID' as any;
        loan.cancelledAt = loan.cancelledAt; // no change
        // Optional: internal collateral release could be implemented here in DEV
      }
      await loan.save();

      await Transaction.create({ user: userId as any, type: 'loan-repayment', amount: repayAmt, asset: borrowAsset.symbol, status: 'completed', loanId: loan._id });

      return c.json(await withRatesAsync(loan.toJSON(), borrowAsset));
    }

    // EXTERNAL
    if (IS_DEV) {
      loan.loanAmount = Number(loan.loanAmount || 0) - repayAmt;
      if (loan.loanAmount <= 0) { loan.loanAmount = 0; loan.status = 'REPAID' as any; }
      await loan.save();
      await Transaction.create({ user: userId as any, type: 'loan-repayment', amount: repayAmt, asset: borrowAsset.symbol, status: 'completed', loanId: loan._id });
      return c.json(await withRatesAsync(loan.toJSON(), borrowAsset));
    } else {
      // In production, we do NOT accept txHash for EXTERNAL repayments.
      // We return the repayment address and wait for webhook/processor to confirm funds and reduce principal.
      return c.json({
        message: 'Awaiting on-chain repayment. Send funds to the repayment address.',
        repayment: {
          address: String((await Loan.findById(id))?.collateralReceivingAddress || ''),
          asset: borrowAsset.symbol,
          network: String((await Loan.findById(id))?.borrowNetwork || ''),
          expectedAmountToken: repayAmt,
        },
        loanId: String(id),
      });
    }
  } catch (error) {
    console.error('Repay confirm error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

// --- Alerts configuration ---
export const getLoanAlerts = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id } = c.req.valid('param' as never) as z.infer<typeof loanIdParamSchema>;
  const loan = await Loan.findOne({ _id: id, userId }).select('alerts');
  if (!loan) return c.json({ error: 'Loan not found' }, 404);
  return c.json({ alerts: loan.alerts || { interest: { thresholds: [] }, collateral: { dipping: false, thresholds: [] } } });
};

export const updateLoanAlerts = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id } = c.req.valid('param' as never) as z.infer<typeof loanIdParamSchema>;
  const body = c.req.valid('json' as never) as any;

  try {
    const loan = await Loan.findOne({ _id: id, userId });
    if (!loan) return c.json({ error: 'Loan not found' }, 404);

    // Merge updates into alerts
    const next = loan.alerts || { interest: { thresholds: [] }, collateral: { dipping: false, thresholds: [] } };
    if (body.interest) {
      if (Array.isArray(body.interest.thresholds)) next.interest = { ...(next.interest || {}), thresholds: body.interest.thresholds };
    }
    if (body.collateral) {
      const prevC = next.collateral || { dipping: false, thresholds: [] };
      next.collateral = {
        dipping: typeof body.collateral.dipping === 'boolean' ? body.collateral.dipping : prevC.dipping,
        thresholds: Array.isArray(body.collateral.thresholds) ? body.collateral.thresholds : prevC.thresholds,
      };
    }

    loan.alerts = next as any;
    await loan.save();

    return c.json({ alerts: loan.alerts });
  } catch (e) {
    console.error('Update loan alerts error:', e);
    return c.json({ error: 'Internal server error' }, 500);
  }
};

export const cancelLoan = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { id } = c.req.valid('param' as never) as z.infer<typeof loanIdParamSchema>;
  const loan = await Loan.findOne({ _id: id, userId, status: 'PENDING_COLLATERAL' });
  if (!loan) return c.json({ error: 'Loan not found or not cancellable' }, 404);
  loan.status = 'CANCELLED';
  loan.cancelledAt = new Date();
  await loan.save();
  return c.json({ message: 'Loan cancelled' });
};

