import Loan, { LoanStatus } from '../models/Loan';
import Asset from '../models/Asset';
import Transaction from '../models/Transaction';
import { getUsdPriceForAsset } from '../helpers/tatum/rates';
import { isDbConnected } from '../config/db';

const IS_DEV = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';
const MC_LTV = Number(process.env.MARGIN_CALL_LTV ?? 0.7);
const LQ_LTV = Number(process.env.LIQUIDATION_LTV ?? 0.8);

export function startMarginMonitor() {
  const BATCH = Number(process.env.JOB_BATCH_SIZE || 1000);
  let running = false;

  setInterval(async () => {
    if (running) return; // prevent overlapping runs
    running = true;
    try {
      if (!isDbConnected()) return;

      const filter: any = { status: LoanStatus.ACTIVE };
      let lastId: any = null;
      while (true) {
        const loans = await Loan.find(lastId ? { ...filter, _id: { $gt: lastId } } : filter)
          .select('_id userId loanAssetId collateralAssetId loanAmount collateralReceivedAmountToken')
          .sort({ _id: 1 })
          .limit(BATCH)
          .lean();
        if (!loans.length) break;

        // Fetch assets for this batch
        const assetIds = Array.from(
          new Set(loans.flatMap((l: any) => [String(l.loanAssetId), String(l.collateralAssetId)]))
        );
        const assets = await Asset.find({ _id: { $in: assetIds } }).select('_id symbol network currentPrice').lean();
        const assetMap = new Map<string, any>(assets.map((a: any) => [String(a._id), a]));

        // Price cache per assetId (avoid duplicate remote calls in production)
        const priceCache = new Map<string, number>();
        const resolvePrice = async (a: any) => {
          if (!a) return 0;
          const key = String(a._id);
          if (priceCache.has(key)) return priceCache.get(key)!;
          const p = IS_DEV ? Number(a.currentPrice || 0) : Number(await getUsdPriceForAsset(String(a.network || ''), String(a.symbol || '')) || 0);
          priceCache.set(key, p || 0);
          return p || 0;
        };

        const updates: any[] = [];
        const txs: any[] = [];

        for (const loan of loans as any[]) {
          const borrowAsset = assetMap.get(String(loan.loanAssetId));
          const collateralAsset = assetMap.get(String(loan.collateralAssetId));
          if (!borrowAsset || !collateralAsset) continue;

          const borrowUsd = await resolvePrice(borrowAsset);
          const collateralUsd = await resolvePrice(collateralAsset);

          const loanUsd = Number(loan.loanAmount || 0) * (borrowUsd || 0);
          const collateralUsdValue = Number(loan.collateralReceivedAmountToken || 0) * (collateralUsd || 0);

          const ltv = collateralUsdValue > 0 ? (loanUsd / collateralUsdValue) : Infinity;

          if (ltv >= LQ_LTV || !isFinite(ltv)) {
            updates.push({ updateOne: { filter: { _id: loan._id }, update: { $set: { status: LoanStatus.LIQUIDATED } } } });
            txs.push({ user: loan.userId as any, type: 'liquidation', amount: loan.loanAmount, asset: borrowAsset.symbol, status: 'completed', loanId: loan._id });
            continue;
          }
          if (ltv >= MC_LTV) {
            txs.push({ user: loan.userId as any, type: 'margin-call', amount: 0, asset: borrowAsset.symbol, status: 'completed', loanId: loan._id });
          }
        }

        if (updates.length) await Loan.bulkWrite(updates, { ordered: false });
        if (txs.length) await Transaction.insertMany(txs, { ordered: false });

        lastId = loans[loans.length - 1]._id;
      }
    } catch (e) {
      console.error('Margin monitor error', e);
    } finally {
      running = false;
    }
  }, 60 * 1000); // every minute
}

