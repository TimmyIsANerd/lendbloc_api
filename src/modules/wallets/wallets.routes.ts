import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import {
  getUserWallets,
  getWalletDetails,
  createWallet,
  getWalletByAddress
} from './wallets.controller';

const wallets = new Hono();

wallets.use('/*', authMiddleware);
wallets.get('/', getUserWallets);
wallets.get('/:id', getWalletDetails);
wallets.get("/address/:walletAddress", getWalletByAddress)
wallets.post('/', createWallet);

export default wallets;
