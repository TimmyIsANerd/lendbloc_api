import { type Context } from 'hono';
import { z } from 'zod';
import axios from 'axios';
import mongoose from 'mongoose';
import Asset from '../../models/Asset';
import Vote from '../../models/Vote';
import User, { AccountType } from '../../models/User';
import UserBalance from '../../models/UserBalance';
import Transaction from '../../models/Transaction';
import Wallet from '../../models/Wallet';
import { getUsdPriceForAsset, getUsdRatesForNetwork } from '../../helpers/tatum/rates';
import { getWalletBalance } from '../../helpers/tatum/balance';
import { roundTo8 } from '../../utils/number';
import { priceChangeQuerySchema, quoteSchema, swapBySymbolSchema, voteForCoinSchema } from './exchange.validation';

const TEST_ENV: boolean = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

async function findListedAssetBySymbol(symbol: string) {
  return Asset.findOne({ symbol: symbol.toUpperCase(), status: 'LISTED' });
}

async function getUsdPriceWithFallback(asset: any): Promise<number> {
  try {
    const p = await getUsdPriceForAsset(asset.network, asset.symbol);
    if (p && p > 0) return p;
  } catch {}
  return Number(asset.currentPrice || 0) || 0;
}

async function getUsdPrices(fromAsset: any, toAsset: any): Promise<{ fromUsd: number; toUsd: number }> {
  // In DEVELOPMENT (tests), avoid external calls and use currentPrice for determinism/speed
  if (TEST_ENV) {
    return {
      fromUsd: Number(fromAsset.currentPrice) || 0,
      toUsd: Number(toAsset.currentPrice) || 0,
    };
  }

  // If same network, we can batch; else fetch independently
  if (fromAsset.network === toAsset.network) {
    try {
      const rates = await getUsdRatesForNetwork(fromAsset.network, [fromAsset.symbol, toAsset.symbol]);
      const fromUsd = rates.get(fromAsset.symbol) || 0;
      const toUsd = rates.get(toAsset.symbol) || 0;
      return {
        fromUsd: fromUsd > 0 ? fromUsd : (Number(fromAsset.currentPrice) || 0),
        toUsd: toUsd > 0 ? toUsd : (Number(toAsset.currentPrice) || 0),
      };
    } catch {
      // Fallback
      return {
        fromUsd: Number(fromAsset.currentPrice) || 0,
        toUsd: Number(toAsset.currentPrice) || 0,
      };
    }
  }
  // Different networks
  const [fromUsd, toUsd] = await Promise.all([
    getUsdPriceWithFallback(fromAsset),
    getUsdPriceWithFallback(toAsset),
  ]);
  return { fromUsd, toUsd };
}

function getFeePercents(fromAsset: any, toAsset: any, acct: AccountType) {
  const fromFeePercent = Number((fromAsset.fees?.exchangeFeePercentFrom as any)?.[acct] ?? 0);
  const toFeePercent = Number((toAsset.fees?.exchangeFeePercentTo as any)?.[acct] ?? 0);
  return { fromFeePercent, toFeePercent };
}

async function resolveLiquidityBalance(symbol: string, networkKey: string, preferAddress?: string): Promise<number> {
  // DEV: use fake liquidity if set
  if (TEST_ENV) {
    const envKey = `FAKE_LIQ_${symbol.toUpperCase()}`;
    const fake = process.env[envKey];
    if (fake !== undefined) return Number(fake) || 0;
    // Default to 0 in DEV if not set, so tests are explicit
    return 0;
  }
  // PROD: use Tatum
  const liquidityWallet = await Wallet.findOne({ isLiquidityWallet: true, network: networkKey });
  if (!liquidityWallet) return 0;
  const balances = await getWalletBalance(networkKey, preferAddress || liquidityWallet.address);
  // Find the asset entry matching symbol
  const match = (balances || []).find((b: any) => String(b.asset).toUpperCase() === symbol.toUpperCase());
  const bal = match ? Number(match.balance || 0) : 0;
  return bal;
}

export const quoteSwap = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { fromSymbol, toSymbol, amount } = c.req.valid('json' as never) as z.infer<typeof quoteSchema>;

  if (fromSymbol.toUpperCase() === toSymbol.toUpperCase()) {
    return c.json({ error: 'fromSymbol and toSymbol cannot be the same' }, 400);
  }

  try {
    const [fromAsset, toAsset] = await Promise.all([
      findListedAssetBySymbol(fromSymbol),
      findListedAssetBySymbol(toSymbol),
    ]);
    if (!fromAsset || !toAsset) {
      return c.json({ error: 'Invalid asset symbol(s)' }, 400);
    }

    const user = await User.findById(userId).select('accountType');
    const acct: AccountType = user?.accountType || AccountType.REG;

    const { fromUsd, toUsd } = await getUsdPrices(fromAsset, toAsset);

    // Convert via USD parity
    const fromUsdValue = amount * fromUsd;
    const convertedAmount = fromUsdValue / (toUsd || 1);

    // Fees
    const { fromFeePercent, toFeePercent } = getFeePercents(fromAsset, toAsset, acct);
    const fromFeeAmount = amount * (fromFeePercent / 100);
    const toFeeAmount = convertedAmount * (toFeePercent / 100);
    const netToAmount = roundTo8(convertedAmount - toFeeAmount);
    const netToUsd = netToAmount * toUsd;

    return c.json({
      fromSymbol: fromAsset.symbol,
      toSymbol: toAsset.symbol,
      amountFrom: amount,
      amountFromUsd: fromUsdValue,
      amountTo: netToAmount, // after fee as requested
      amountToUsd: netToUsd,
      unitPrices: { fromUsd, toUsd },
      fees: { fromFeePercent, toFeePercent, fromFeeAmount, toFeeAmount },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error generating quote:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};

export const priceChange = async (c: Context) => {
  const { from, to } = c.req.valid('query' as never) as z.infer<typeof priceChangeQuerySchema>;
  try {
    const baseURL = process.env.CMC_BASE_URL || 'https://pro-api.coinmarketcap.com';
    const apiKey = process.env.CMC_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'CMC_API_KEY not configured' }, 500);
    }

    const symbols = [from.toUpperCase(), to.toUpperCase()].join(',');
    const { data } = await axios.get(`${baseURL}/v1/cryptocurrency/quotes/latest`, {
      params: { symbol: symbols },
      headers: { 'X-CMC_PRO_API_KEY': apiKey, Accept: 'application/json' },
      timeout: 30000,
    });

    const d = data?.data || {};
    const fromData = d[from.toUpperCase()]?.quote?.USD;
    const toData = d[to.toUpperCase()]?.quote?.USD;

    const fromPct = fromData?.percent_change_24h ?? null;
    const toPct = toData?.percent_change_24h ?? null;

    return c.json({
      from: { symbol: from.toUpperCase(), percentChange24h: fromPct !== null ? Number(Number(fromPct).toFixed(2)) : null },
      to: { symbol: to.toUpperCase(), percentChange24h: toPct !== null ? Number(Number(toPct).toFixed(2)) : null },
    });
  } catch (error) {
    console.error('Error fetching price change from CMC:', error);
    return c.json({ error: 'Failed to fetch price change' }, 500);
  }
};

export const swapBySymbol = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { fromSymbol, toSymbol, amount } = c.req.valid('json' as never) as z.infer<typeof swapBySymbolSchema>;

  if (fromSymbol.toUpperCase() === toSymbol.toUpperCase()) {
    return c.json({ error: 'fromSymbol and toSymbol cannot be the same' }, 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [fromAsset, toAsset] = await Promise.all([
      findListedAssetBySymbol(fromSymbol),
      findListedAssetBySymbol(toSymbol),
    ]);
    if (!fromAsset || !toAsset) {
      await session.abortTransaction();
      return c.json({ error: 'Invalid asset symbol(s)' }, 400);
    }

    const user = await User.findById(userId).select('accountType');
    const acct: AccountType = user?.accountType || AccountType.REG;

    // Fetch user balance for source asset
    const fromBalDoc = await UserBalance.findOne({ userId, assetId: fromAsset._id }).session(session);
    if (!fromBalDoc || fromBalDoc.balance <= 0) {
      await session.abortTransaction();
      return c.json({ error: 'Insufficient balance in source asset' }, 400);
    }

    const { fromUsd, toUsd } = await getUsdPrices(fromAsset, toAsset);
    const fromUsdValue = amount * fromUsd;
    const convertedAmount = fromUsdValue / (toUsd || 1);

    // Fees
    const { fromFeePercent, toFeePercent } = getFeePercents(fromAsset, toAsset, acct);
    const fromFeeAmount = amount * (fromFeePercent / 100);
    const toFeeAmount = convertedAmount * (toFeePercent / 100);

    const totalDebit = amount + fromFeeAmount;
    if ((fromBalDoc.balance ?? 0) < totalDebit) {
      await session.abortTransaction();
      return c.json({ error: 'Insufficient balance in source asset to cover amount and fee' }, 400);
    }

    const netToAmount = roundTo8(convertedAmount - toFeeAmount);
    const netToUsd = netToAmount * toUsd;

    // Liquidity check (destination asset)
    const liqTokens = await resolveLiquidityBalance(toAsset.symbol, toAsset.network);
    const liqUsd = (Number(liqTokens) || 0) * (toUsd || 0);
    if (liqUsd < netToUsd) {
      await session.abortTransaction();
      return c.json({ error: 'Insufficient liquidity to fulfill this swap' }, 400);
    }

    // Perform atomic balance updates under transaction
    await UserBalance.updateOne({ userId, assetId: fromAsset._id }, { $inc: { balance: -totalDebit } }, { session });
    await UserBalance.findOneAndUpdate(
      { userId, assetId: toAsset._id },
      { $inc: { balance: netToAmount } },
      { upsert: true, new: true, session }
    );

    // Create transaction record with swap details
    await Transaction.create([
      {
        user: userId,
        type: 'swap',
        amount: netToAmount, // net credited amount (token)
        asset: toAsset.symbol,
        status: 'completed',
        grossAmount: convertedAmount,
        netAmount: netToAmount,
        feePercent: toFeePercent,
        feeAmount: toFeeAmount,
        swapDetails: {
          fromAssetId: fromAsset._id,
          toAssetId: toAsset._id,
          fromSymbol: fromAsset.symbol,
          toSymbol: toAsset.symbol,
          fromAmountToken: amount,
          toAmountToken: netToAmount,
          fromAmountUsd: fromUsdValue,
          toAmountUsd: netToUsd,
          fromFeePercent,
          toFeePercent,
          fromFeeAmountToken: fromFeeAmount,
          toFeeAmountToken: toFeeAmount,
          rateFromUsd: fromUsd,
          rateToUsd: toUsd,
        },
      },
    ], { session });

    await session.commitTransaction();

    return c.json({
      message: 'Swap successful',
      from: {
        symbol: fromAsset.symbol,
        amount,
        usdValue: fromUsdValue,
        feePercent: fromFeePercent,
        feeAmount: fromFeeAmount,
      },
      to: {
        symbol: toAsset.symbol,
        amount: netToAmount,
        usdValue: netToUsd,
        feePercent: toFeePercent,
        feeAmount: toFeeAmount,
      },
      unitPrices: { fromUsd, toUsd },
    });
  } catch (error: any) {
    // If transactions are not supported (common in test Mongo setups), fallback to non-transactional updates
    if (error?.code === 20 || /Transaction numbers are only allowed/.test(String(error?.message))) {
      try { await session.abortTransaction(); } catch {}
      try {
        const fromAsset = await findListedAssetBySymbol(fromSymbol);
        const toAsset = await findListedAssetBySymbol(toSymbol);
        if (!fromAsset || !toAsset) return c.json({ error: 'Invalid asset symbol(s)' }, 400);

        const user = await User.findById(userId).select('accountType');
        const acct: AccountType = user?.accountType || AccountType.REG;
        const { fromUsd, toUsd } = await getUsdPrices(fromAsset, toAsset);
        const fromUsdValue = amount * fromUsd;
        const convertedAmount = fromUsdValue / (toUsd || 1);
        const { fromFeePercent, toFeePercent } = getFeePercents(fromAsset, toAsset, acct);
        const fromFeeAmount = amount * (fromFeePercent / 100);
        const toFeeAmount = convertedAmount * (toFeePercent / 100);
        const totalDebit = amount + fromFeeAmount;
        const netToAmount = roundTo8(convertedAmount - toFeeAmount);
        const netToUsd = netToAmount * toUsd;

        // Liquidity check again
        const liqTokens = await resolveLiquidityBalance(toAsset.symbol, toAsset.network);
        const liqUsd = (Number(liqTokens) || 0) * (toUsd || 0);
        if (liqUsd < netToUsd) {
          return c.json({ error: 'Insufficient liquidity to fulfill this swap' }, 400);
        }

        // Conditional debit to avoid race conditions
        const debitRes: any = await UserBalance.updateOne(
          { userId, assetId: fromAsset._id, balance: { $gte: totalDebit } },
          { $inc: { balance: -totalDebit } }
        );
        const modified = debitRes?.modifiedCount ?? debitRes?.nModified ?? 0;
        if (modified === 0) {
          return c.json({ error: 'Insufficient balance in source asset to cover amount and fee' }, 400);
        }

        await UserBalance.findOneAndUpdate(
          { userId, assetId: toAsset._id },
          { $inc: { balance: netToAmount } },
          { upsert: true, new: true }
        );

        await Transaction.create({
          user: userId,
          type: 'swap',
          amount: netToAmount,
          asset: toAsset.symbol,
          status: 'completed',
          grossAmount: convertedAmount,
          netAmount: netToAmount,
          feePercent: toFeePercent,
          feeAmount: toFeeAmount,
          swapDetails: {
            fromAssetId: fromAsset._id,
            toAssetId: toAsset._id,
            fromSymbol: fromAsset.symbol,
            toSymbol: toAsset.symbol,
            fromAmountToken: amount,
            toAmountToken: netToAmount,
            fromAmountUsd: fromUsdValue,
            toAmountUsd: netToUsd,
            fromFeePercent,
            toFeePercent,
            fromFeeAmountToken: fromFeeAmount,
            toFeeAmountToken: toFeeAmount,
            rateFromUsd: fromUsd,
            rateToUsd: toUsd,
          },
        });

        return c.json({
          message: 'Swap successful',
          from: { symbol: fromAsset.symbol, amount, usdValue: fromUsdValue, feePercent: fromFeePercent, feeAmount: fromFeeAmount },
          to: { symbol: toAsset.symbol, amount: netToAmount, usdValue: netToUsd, feePercent: toFeePercent, feeAmount: toFeeAmount },
          unitPrices: { fromUsd, toUsd },
        });
      } catch (innerErr) {
        console.error('Swap fallback error:', innerErr);
        return c.json({ error: 'An unexpected error occurred' }, 500);
      } finally {
        session.endSession();
      }
    }

    console.error('Error during swap:', error);
    try { await session.abortTransaction(); } catch {}
    return c.json({ error: 'An unexpected error occurred' }, 500);
  } finally {
    try { session.endSession(); } catch {}
  }
};

export const voteForCoin = async (c: Context) => {
  const userId = c.get('jwtPayload').userId;
  const { coinName } = c.req.valid('json' as never) as z.infer<
    typeof voteForCoinSchema
  >;

  try {
    await Vote.create({ userId, coinName });

    return c.json({ message: `Vote for ${coinName} recorded successfully` });
  } catch (error) {
    console.error('Error during coin voting:', error);
    return c.json({ error: 'An unexpected error occurred' }, 500);
  }
};
