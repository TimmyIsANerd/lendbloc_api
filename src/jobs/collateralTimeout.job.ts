import Loan, { LoanStatus } from '../models/Loan';

const COLLATERAL_TIMEOUT_MINUTES = Number(process.env.COLLATERAL_TIMEOUT_MINUTES ?? 20);

// This simple interval task checks for loans that are pending collateral and have passed their expiry.
// In a production-grade setup, consider a job runner with persistence (BullMQ, Agenda) instead of in-memory intervals.
export function startCollateralTimeoutWatcher() {
  setInterval(async () => {
    try {
      const now = new Date();
      const stale = await Loan.updateMany(
        { status: LoanStatus.PENDING_COLLATERAL, expiresAt: { $lt: now } },
        { $set: { status: LoanStatus.CANCELLED, cancelledAt: now } }
      );
      if ((stale?.modifiedCount ?? 0) > 0) {
        console.log(`Collateral timeout watcher: cancelled ${stale.modifiedCount} stale pending loans.`);
      }
    } catch (e) {
      console.error('Collateral timeout watcher error:', e);
    }
  }, 60 * 1000); // every minute
}

