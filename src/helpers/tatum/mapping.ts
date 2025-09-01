export const mapTatumChainToInternalNetwork = (chain: string): string => {
  const c = chain.toLowerCase();
  switch (c) {
    case 'ethereum':
      return 'ETH_MAINNET';
    case 'ethereum-sepolia':
      return 'ETH_SEPOLIA';
    case 'bsc':
      return 'BSC_MAINNET';
    case 'bsc-testnet':
      return 'BSC_TESTNET';
    case 'polygon':
      return 'MATIC_MAINNET';
    case 'polygon-amoy':
      return 'MATIC_AMOY';
    case 'tron':
      return 'TRON_MAINNET';
    case 'tron-shasta':
      return 'TRON_SHASTA';
    case 'bitcoin':
      return 'BTC_MAINNET';
    case 'bitcoin-testnet':
      return 'BTC_TESTNET';
    case 'litecoin':
      return 'LTC_MAINNET';
    case 'litecoin-testnet':
      return 'LTC_TESTNET';
    default:
      return chain.toUpperCase();
  }
};

export const toWalletNetwork = (internalNetwork: string): 'ETH' | 'BSC' | 'TRON' | 'BTC' | 'LTC' => {
  if (internalNetwork.startsWith('ETH')) return 'ETH';
  if (internalNetwork.startsWith('BSC')) return 'BSC';
  if (internalNetwork.startsWith('TRON')) return 'TRON';
  if (internalNetwork.startsWith('BTC')) return 'BTC';
  if (internalNetwork.startsWith('LTC')) return 'LTC';
  // Fallback: default to ETH to avoid schema violations
  return 'ETH';
};

