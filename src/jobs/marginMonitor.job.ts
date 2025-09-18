import Loan, { LoanStatus } from '../models/Loan';
import Asset from '../models/Asset';
import Transaction from '../models/Transaction';
import { getUsdPriceForAsset } from '../helpers/tatum/rates';
import { isDbConnected } from '../config/db';

const IS_DEV = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';
const MC_LTV = Number(process.env.MARGIN_CALL_LTV ?? 0.7);
const LQ_LTV = Number(process.env.LIQUIDATION_LTV ?? 0.8);

export function startMarginMonitor() {
  setInterval(async () => {
    if (!isDbConnected()) return;
    try {
      const active = await Loan.find({ status: LoanStatus.ACTIVE });
      for (const loan of active) {
        const borrowAsset = await Asset.findById(loan.loanAssetId);
        const collateralAsset = await Asset.findById(loan.collateralAssetId);
        if (!borrowAsset || !collateralAsset) continue;
        const borrowUsd = IS_DEV ? Number(borrowAsset.currentPrice) || 0 : await getUsdPriceForAsset(borrowAsset.network, borrowAsset.symbol);
        const collateralUsd = IS_DEV ? Number(collateralAsset.currentPrice) || 0 : await getUsdPriceForAsset(collateralAsset.network, collateralAsset.symbol);

        const loanUsd = (loan.loanAmount || 0) * (borrowUsd || 0);
        const collateralUsdValue = (loan.collateralReceivedAmountToken || 0) * (collateralUsd || 0);

        // LTV (loan / collateral). If collateral is 0, mark for liquidation immediately.
        const ltv = collateralUsdValue > 0 ? (loanUsd / collateralUsdValue) : Infinity;

        if (ltv >= LQ_LTV || !isFinite(ltv)) {
          // Liquidate: mark status, record transaction; real sale not implemented here
          await Loan.updateOne({ _id: loan._id }, { $set: { status: LoanStatus.LIQUIDATED } });
          await Transaction.create({ user: loan.userId as any, type: 'liquidation', amount: loan.loanAmount, asset: borrowAsset.symbol, status: 'completed', loanId: loan._id });
          continue;
        }
        if (ltv >= MC_LTV) {
          // Margin call notification stub; create a transaction of type 'margin-call' as an audit marker
          await Transaction.create({ user: loan.userId as any, type: 'margin-call', amount: 0, asset: borrowAsset.symbol, status: 'completed', loanId: loan._id });
        }
      }
    } catch (e) {
      console.error('Margin monitor error', e);
    }
  }, 60 * 1000); // every minute
}

