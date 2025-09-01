import { createPublicClient, http } from 'viem';
import { mainnet, sepolia, bsc, bscTestnet, polygon, polygonAmoy } from 'viem/chains';
import { mapTatumChainToInternalNetwork } from './mapping';

const TEST_ENV: boolean = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

const getViemChain = (internal: string) => {
  switch (internal) {
    case 'ETH_MAINNET': return mainnet;
    case 'ETH_SEPOLIA': return sepolia;
    case 'ETH': return TEST_ENV ? sepolia : mainnet;
    case 'BSC_MAINNET': return bsc;
    case 'BSC_TESTNET': return bscTestnet;
    case 'BSC': return TEST_ENV ? bscTestnet : bsc;
    case 'MATIC_MAINNET': return polygon;
    case 'MATIC_AMOY': return polygonAmoy;
    case 'MATIC': return TEST_ENV ? polygonAmoy : polygon;
    default: return null;
  }
};

const getRpcTransport = (internal: string, chain: any) => {
  const envKeyMap: Record<string, string> = {
    ETH_MAINNET: 'ETH_MAINNET_RPC_URL',
    ETH_SEPOLIA: 'ETH_SEPOLIA_RPC_URL',
    ETH: TEST_ENV ? 'ETH_SEPOLIA_RPC_URL' : 'ETH_MAINNET_RPC_URL',
    BSC_MAINNET: 'BSC_MAINNET_RPC_URL',
    BSC_TESTNET: 'BSC_TESTNET_RPC_URL',
    BSC: TEST_ENV ? 'BSC_TESTNET_RPC_URL' : 'BSC_MAINNET_RPC_URL',
    MATIC_MAINNET: 'POLYGON_MAINNET_RPC_URL',
    MATIC_AMOY: 'POLYGON_AMOY_RPC_URL',
    MATIC: TEST_ENV ? 'POLYGON_AMOY_RPC_URL' : 'POLYGON_MAINNET_RPC_URL',
  };
  const envKey = envKeyMap[internal];
  const url = envKey ? process.env[envKey] : undefined;
  const fallback = chain?.rpcUrls?.default?.http?.[0];
  return http(url ?? fallback);
};

export const confirmTransaction = async ({ txId, chain, blockNumber }: { txId: string; chain: string; blockNumber: number; }): Promise<boolean> => {
  try {
    const internal = mapTatumChainToInternalNetwork(chain);
    const isEvm = internal.startsWith('ETH') || internal.startsWith('BSC') || internal.startsWith('MATIC');

    if (isEvm) {
      const viemChain = getViemChain(internal);
      if (!viemChain) return false;
      const client = createPublicClient({ chain: viemChain, transport: getRpcTransport(internal, viemChain) });
      const receipt = await client.getTransactionReceipt({ hash: txId as `0x${string}` });
      if (!receipt || !receipt.blockNumber) return false;
      // Confirmed if the receipt has a block number and it's at least the webhook's reported block
      return Number(receipt.blockNumber) >= Number(blockNumber);
    }

    // For non-EVM chains, fall back to a minimal check for now.
    return Number(blockNumber) > 0;
  } catch (e) {
    return false;
  }
};

