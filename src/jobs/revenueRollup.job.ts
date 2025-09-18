import { startOfDay, endOfDay, format, subDays } from 'date-fns';
import RevenueEvent from '../models/RevenueEvent';
import RevenueDaily from '../models/RevenueDaily';
import { isDbConnected } from '../config/db';

async function rollupDate(d: Date) {
  const from = startOfDay(d);
  const to = endOfDay(d);
  const dateStr = format(from, 'yyyy-MM-dd');

  const events = await RevenueEvent.find({ createdAt: { $gte: from, $lte: to } }).select('type amountUsd').lean();
  const byType: Record<string, number> = {};
  for (const e of events) {
    byType[e.type] = (byType[e.type] || 0) + (Number(e.amountUsd) || 0);
  }
  const totalUsd = Object.values(byType).reduce((a, b) => a + Number(b || 0), 0);

  await RevenueDaily.findOneAndUpdate(
    { dateStr },
    { $set: { byType, totalUsd } },
    { upsert: true }
  );
}

export function startRevenueRollupJob() {
  // roll yesterday and day before on boot
  (async () => {
    try {
      if (!isDbConnected()) return;
      await rollupDate(subDays(new Date(), 1));
      await rollupDate(subDays(new Date(), 2));
    } catch (e) {
      console.error('Initial revenue rollup error:', e);
    }
  })();

  const hourMs = 60 * 60 * 1000;
  setInterval(async () => {
    if (!isDbConnected()) return;
    try {
      await rollupDate(subDays(new Date(), 1));
    } catch (e) {
      console.error('Scheduled revenue rollup error:', e);
    }
  }, hourMs);
}