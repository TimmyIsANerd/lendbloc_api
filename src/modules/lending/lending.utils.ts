import { format, addMonths } from 'date-fns';
import Asset from '../../models/Asset';
import Wallet from '../../models/Wallet';
import { getUsdPriceForAsset, getUsdRatesForNetwork } from '../../helpers/tatum/rates';
import { getWalletBalance } from '../../helpers/tatum/balance';

const IS_DEV = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

export function ordinalDate(d: Date) {
  return format(d, "do MMMM, yyyy");
}

export async function resolveUsdPrices(borrowAsset: any, collateralAsset: any) {
  if (IS_DEV) {
    return {
      borrowUsd: Number(borrowAsset.currentPrice) || 0,
      collateralUsd: Number(collateralAsset.currentPrice) || 0,
    };
  }

  if (borrowAsset.network === collateralAsset.network) {
    try {
      const rates = await getUsdRatesForNetwork(borrowAsset.network, [borrowAsset.symbol, collateralAsset.symbol]);
      const b = rates.get(borrowAsset.symbol) || 0;
      const c = rates.get(collateralAsset.symbol) || 0;
      return {
        borrowUsd: b > 0 ? b : (Number(borrowAsset.currentPrice) || 0),
        collateralUsd: c > 0 ? c : (Number(collateralAsset.currentPrice) || 0),
      };
    } catch {}
  }
  const [b, c] = await Promise.all([
    getUsdPriceForAsset(borrowAsset.network, borrowAsset.symbol).catch(() => 0),
    getUsdPriceForAsset(collateralAsset.network, collateralAsset.symbol).catch(() => 0),
  ]);
  return {
    borrowUsd: b > 0 ? b : (Number(borrowAsset.currentPrice) || 0),
    collateralUsd: c > 0 ? c : (Number(collateralAsset.currentPrice) || 0),
  };
}

export async function resolveLiquidityTokens(symbol: string, networkKey: string): Promise<number> {
  if (IS_DEV) {
    const envKey = `FAKE_LIQ_${symbol.toUpperCase()}`;
    const fake = process.env[envKey];
    if (fake !== undefined) return Number(fake) || 0;
    return 0;
  }
  const liquidityWallet = await Wallet.findOne({ isLiquidityWallet: true, network: networkKey });
  if (!liquidityWallet) return 0;
  const balances = await getWalletBalance(networkKey, liquidityWallet.address);
  const match = (balances || []).find((b: any) => String(b.asset).toUpperCase() === symbol.toUpperCase());
  const bal = match ? Number(match.balance || 0) : 0;
  return bal;
}

export function computeRequiredCollateralTokens(borrowAmount: number, targetLtvLoanToCollateral: number, collateralUsd: number, borrowUsd: number): number {
  // LTV = Loan / CollateralValue. target is 0.5. CollateralValue = Loan / 0.5 = 2 * Loan
  const requiredCollateralUsd = borrowAmount * borrowUsd / (targetLtvLoanToCollateral || 1);
  return (collateralUsd > 0) ? (requiredCollateralUsd / collateralUsd) : 0;
}

export function computeExposureAndThresholds(params: {
  borrowAmount: number;
  borrowUsd: number;
  collateralUsd: number;
  requiredCollateralTokens: number;
  marginCallLtv: number;
  liquidationLtv: number;
}) {
  const { borrowAmount, borrowUsd, collateralUsd, requiredCollateralTokens, marginCallLtv, liquidationLtv } = params;
  const loanUsd = borrowAmount * borrowUsd;
  const collateralValueUsd = requiredCollateralTokens * collateralUsd;
  const equityUsd = collateralValueUsd - loanUsd;

  // Threshold collateral values at which LTV reaches call or liquidation
  // LTV = Loan / CollateralValue => CollateralValue = Loan / LTV
  const marginCallCollateralValueUsd = loanUsd / (marginCallLtv || 1);
  const liquidationCollateralValueUsd = loanUsd / (liquidationLtv || 1);

  // Prices at thresholds (USD per collateral token)
  const marginCallPrice = (requiredCollateralTokens > 0) ? (marginCallCollateralValueUsd / requiredCollateralTokens) : 0;
  const liquidationPrice = (requiredCollateralTokens > 0) ? (liquidationCollateralValueUsd / requiredCollateralTokens) : 0;

  // Distance to margin call as percent drop from current collateral price
  const distanceToMarginCallPercent = (collateralUsd > 0) ? ((collateralUsd - marginCallPrice) / collateralUsd) * 100 : 0;

  return {
    equityUsd,
    distanceToMarginCallPercent,
    marginCallPrice,
    liquidationPrice,
    marginCallCollateralValueUsd,
    liquidationCollateralValueUsd,
  };
}

export function nextMonthlyInterestDate(now = new Date()) {
  return addMonths(now, 1);
}

