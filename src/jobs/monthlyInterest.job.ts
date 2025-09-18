import Loan, { LoanStatus } from '../models/Loan';
import Asset from '../models/Asset';
import Transaction from '../models/Transaction';
import { isDbConnected } from '../config/db';

// Monthly interest accrual: capitalize interest if unpaid, advance nextInterestAt.
export function startMonthlyInterestAccrual() {
  const dayMs = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    if (!isDbConnected()) return;
    const now = new Date();
    try {
      const due = await Loan.find({ status: LoanStatus.ACTIVE, nextInterestAt: { $lte: now } });
      for (const loan of due) {
        const borrowAsset = await Asset.findById(loan.loanAssetId);
        if (!borrowAsset) continue;
        const monthlyRate = Number(loan.interestRate || 0) / 100;
        const interest = (loan.loanAmount || 0) * monthlyRate;

        // Capitalize
        loan.loanAmount = (loan.loanAmount || 0) + interest;
        const next = new Date(loan.nextInterestAt || now);
        next.setMonth(next.getMonth() + 1);
        loan.nextInterestAt = next;
        await loan.save();

        await Transaction.create({
          user: loan.userId as any,
          type: 'interest-accrual',
          amount: interest,
          asset: borrowAsset.symbol,
          status: 'completed',
          loanId: loan._id,
        });
      }
    } catch (e) {
      console.error('Monthly interest accrual error:', e);
    }
  }, dayMs); // run daily; accrual will apply only when due
}

