import 'dotenv/config'
import connectDB from '../src/config/db'
import Asset from '../src/models/Asset';
import Loan from '../src/models/Loan';
import LoanQuote from '../src/models/LoanQuote';
import User from '../src/models/User';
import Wallet from '../src/models/Wallet';
import Transaction from '../src/models/Transaction';
import UserBalance from '../src/models/UserBalance';
import { seedListedAsset } from '../tests/test-utils';

// Quick DEV seed for lending feature: native + USDT on ETH/TRON, and a liquidity wallet hint.
// Run: bun run seeds/seed_lending_assets.ts

(async () => {
  try {
    await connectDB();

    const nativeEth = await seedListedAsset({ symbol: 'ETH', network: 'ETH', currentPrice: 2500 } as any);
    const nativeTrx = await seedListedAsset({ symbol: 'TRX', network: 'TRON', currentPrice: 0.1 } as any);
    const nativeBtc = await seedListedAsset({ symbol: 'BTC', network: 'BTC', currentPrice: 50000 } as any);
    const nativeLtc = await seedListedAsset({ symbol: 'LTC', network: 'LTC', currentPrice: 70 } as any);

    // USDT on ETH (ERC-20) and TRON (TRC-20)
    const usdtEth = await seedListedAsset({ symbol: 'USDT', network: 'ETH', currentPrice: 1, kind: 'erc20', tokenAddress: '0xUSDT_FAKE', decimals: 6 } as any);
    const usdtTron = await seedListedAsset({ symbol: 'USDT', network: 'TRON', currentPrice: 1, kind: 'trc20', tokenAddress: 'TRON_USDT_FAKE', decimals: 6 } as any);

    console.log('Seeded basic lending assets (ETH/TRX/BTC/LTC + USDT on ETH/TRON).');
    console.log('Set env FAKE_LIQ_USDT in DEVELOPMENT to simulate liquidity levels.');
  } catch (e) {
    console.error('Seed error:', e);
  } finally {
    process.exit(0);
  }
})();

