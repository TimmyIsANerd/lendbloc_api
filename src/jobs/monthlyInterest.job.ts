import Loan, { LoanStatus } from '../models/Loan';
import Asset from '../models/Asset';
import Transaction from '../models/Transaction';
import { isDbConnected } from '../config/db';

// Monthly interest accrual: capitalize interest if unpaid, advance nextInterestAt.
// Optimized for low memory usage: paginates and uses lean() + bulk ops.
export function startMonthlyInterestAccrual() {
  const dayMs = 24 * 60 * 60 * 1000;
  const BATCH = Number(process.env.JOB_BATCH_SIZE || 1000);
  let running = false;

  setInterval(async () => {
    if (running) return; // prevent overlap
    running = true;
    try {
      if (!isDbConnected()) return;
      const now = new Date();
      const filter: any = { status: LoanStatus.ACTIVE, nextInterestAt: { $lte: now } };

      let lastId: any = null;
      while (true) {
        const page = await Loan.find(lastId ? { ...filter, _id: { $gt: lastId } } : filter)
          .select('_id userId loanAssetId loanAmount interestRate nextInterestAt')
          .sort({ _id: 1 })
          .limit(BATCH)
          .lean();

        if (!page.length) break;

        // Resolve asset symbols for this batch
        const assetIds = Array.from(new Set(page.map((l: any) => String(l.loanAssetId))));
        const assets = await Asset.find({ _id: { $in: assetIds } }).select('_id symbol').lean();
        const assetMap = new Map<string, string>(assets.map((a: any) => [String(a._id), String(a.symbol || '')]));

        const updates: any[] = [];
        const txDocs: any[] = [];

        for (const loan of page as any[]) {
          const monthlyRate = Number(loan.interestRate || 0) / 100;
          const interest = Number(loan.loanAmount || 0) * monthlyRate;
          const next = new Date(loan.nextInterestAt || now);
          next.setMonth(next.getMonth() + 1);

          updates.push({
            updateOne: {
              filter: { _id: loan._id },
              update: { $inc: { loanAmount: interest }, $set: { nextInterestAt: next } },
            },
          });

          txDocs.push({
            user: loan.userId as any,
            type: 'interest-accrual',
            amount: interest,
            asset: assetMap.get(String(loan.loanAssetId)) || 'USD',
            status: 'completed',
            loanId: loan._id,
          });
        }

        if (updates.length) await Loan.bulkWrite(updates, { ordered: false });
        if (txDocs.length) await Transaction.insertMany(txDocs, { ordered: false });

        lastId = page[page.length - 1]._id;
      }
    } catch (e) {
      console.error('Monthly interest accrual error:', e);
    } finally {
      running = false;
    }
  }, dayMs); // run daily; accrual will apply only when due
}

