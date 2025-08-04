import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth';
import {
  getUserWallets,
  getWalletDetails,
  createWallet,
} from './wallets.controller';

const wallets = new Hono();

wallets.use('/*', authMiddleware);
wallets.get('/', getUserWallets);
wallets.get('/:id', getWalletDetails);
wallets.post('/', createWallet);

export default wallets;
