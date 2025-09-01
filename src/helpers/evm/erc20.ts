import { createPublicClient } from 'viem';
import { mainnet, sepolia, bsc, bscTestnet, polygon, polygonAmoy } from 'viem/chains';
import { http } from 'viem';

const TEST_ENV: boolean = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

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

export const fetchErc20Metadata = async ({
  tokenAddress,
  internalNetwork,
}: {
  tokenAddress: `0x${string}` | string;
  internalNetwork: string;
}): Promise<{ symbol: string; decimals: number }> => {
  const chain = getViemChain(internalNetwork);
  if (!chain) throw new Error(`Unsupported EVM network for metadata: ${internalNetwork}`);
  const client = createPublicClient({ chain, transport: getRpcTransport(internalNetwork, chain) });

  const address = tokenAddress as `0x${string}`;
  const [symbol, decimals] = await Promise.all([
    client.readContract({ address, abi: ERC20_ABI, functionName: 'symbol' as const }),
    client.readContract({ address, abi: ERC20_ABI, functionName: 'decimals' as const }),
  ]);

  return { symbol: String(symbol), decimals: Number(decimals) };
};

export const ERC20_MIN_ABI = ERC20_ABI;

