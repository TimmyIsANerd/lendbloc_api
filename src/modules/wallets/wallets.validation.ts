import { z } from 'zod';

// Address validation patterns for different networks
const btcAddressRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;
const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const tronAddressRegex = /^T[A-Za-z1-9]{33}$/;
const ltcAddressRegex = /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[a-z0-9]{39,59}$/;

export const withdrawFundsSchema = z.object({
  assetSymbol: z.string().min(1, 'Asset symbol is required'),
  amount: z.number().positive('Amount must be positive'),
  toAddress: z.string().min(1, 'Destination address is required'),
}).refine((data) => {
  // We'll validate the address format based on the asset's network in the controller
  // This is a basic validation to ensure the address is not empty
  return data.toAddress.trim().length > 0;
}, {
  message: 'Invalid destination address format',
  path: ['toAddress']
});

// Helper function to validate address based on network
export const validateAddressForNetwork = (address: string, network: string): boolean => {
  switch (network.toUpperCase()) {
    case 'BTC':
      return btcAddressRegex.test(address);
    case 'ETH':
    case 'BSC':
      return ethAddressRegex.test(address);
    case 'TRON':
      return tronAddressRegex.test(address);
    case 'LTC':
      return ltcAddressRegex.test(address);
    default:
      return false;
  }
};