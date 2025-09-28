import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../middleware/auth';
import {
  getUserWallets,
  getWalletDetails,
  createWallet,
  getWalletByAddress,
  withdrawFunds
} from './wallets.controller';
import { withdrawFundsSchema } from './wallets.validation';

const wallets = new Hono();

wallets.use('/*', authMiddleware);
wallets.get('/', getUserWallets);
wallets.get('/:id', getWalletDetails);
wallets.get("/address/:walletAddress", getWalletByAddress);
wallets.post('/', createWallet);
wallets.post('/withdraw', zValidator('json', withdrawFundsSchema), withdrawFunds);

export default wallets;
