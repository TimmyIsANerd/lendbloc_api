import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { mainnet, sepolia, polygon, polygonAmoy, bsc, bscTestnet } from 'viem/chains';
import Wallet from '../../models/Wallet';
import { decryptMnemonic } from '../../helpers/wallet/security';
import { TatumSDK, Network, Tron, Bitcoin, Litecoin } from '@tatumio/tatum';
import { TronWalletProvider } from '@tatumio/tron-wallet-provider';
import { UtxoWalletProvider } from '@tatumio/utxo-wallet-provider';

const TEST_ENV: boolean = process.env.CURRENT_ENVIRONMENT === 'DEVELOPMENT';

// Helper to get Viem chain object based on network string
// Accepts both simplified 'ETH'/'BSC'/'MATIC' and explicit '..._MAINNET'/'..._SEPOLIA'/'..._TESTNET' names.
const getViemChain = (network: string) => {
    switch (network) {
        case 'ETH_MAINNET':
            return mainnet;
        case 'ETH_SEPOLIA':
            return sepolia;
        case 'ETH':
            return TEST_ENV ? sepolia : mainnet;

        case 'BSC_MAINNET':
            return bsc;
        case 'BSC_TESTNET':
            return bscTestnet;
        case 'BSC':
            return TEST_ENV ? bscTestnet : bsc;

        case 'MATIC_MAINNET': // Polygon
            return polygon;
        case 'MATIC_AMOY': // Polygon Amoy Testnet
            return polygonAmoy;
        case 'MATIC':
            return TEST_ENV ? polygonAmoy : polygon;

        default:
            throw new Error(`Unsupported EVM network: ${network}. Supported: ETH(_MAINNET|_SEPOLIA), BSC(_MAINNET|_TESTNET), MATIC(_MAINNET|_AMOY).`);
    }
};

// Helper to get Tatum Network object based on network string
const getTatumNetwork = (network: string) => {
    switch (network) {
        case 'TRON_MAINNET':
            return Network.TRON;
        case 'TRON_SHASTA': // Example TRON testnet
            return Network.TRON_SHASTA;
        case 'TRON':
            return TEST_ENV ? Network.TRON_SHASTA : Network.TRON;

        case 'BTC_MAINNET':
            return Network.BITCOIN;
        case 'BTC_TESTNET':
            return Network.BITCOIN_TESTNET_4;
        case 'BTC':
            return TEST_ENV ? Network.BITCOIN_TESTNET_4 : Network.BITCOIN;

        case 'LTC_MAINNET':
            return Network.LITECOIN;
        case 'LTC_TESTNET':
            return Network.LITECOIN_TESTNET;
        case 'LTC':
            return TEST_ENV ? Network.LITECOIN_TESTNET : Network.LITECOIN;

        default:
            throw new Error(`Unsupported Tatum network or missing testnet/mainnet suffix: ${network}.`);
    }
};

// Resolve an RPC transport for a given EVM network/chain, preferring env vars and falling back to chain defaults
const getRpcTransport = (network: string, chain: any) => {
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
    const envKey = envKeyMap[network];
    const url = envKey ? process.env[envKey] : undefined;
    const fallback = chain?.rpcUrls?.default?.http?.[0];
    if (!url && !fallback) {
        throw new Error(`No RPC URL configured for ${network} and no default RPC available.`);
    }
    return http(url ?? fallback);
};

/**
 * Relocates funds from a user's wallet to the corresponding liquidity wallet.
 * This function is typically called after a webhook notification of a funded wallet.
 *
 * @param userWalletId The ID of the user's wallet that received funds.
 * @param amountReceived The amount of the asset received by the user's wallet.
 * @returns A promise that resolves when the funds have been relocated or an error occurs.
 */
export async function relocateFundsToLiquidityWallet(userWalletId: string, amountReceived: number) {
    try {
        const userWallet = await Wallet.findById(userWalletId);
        if (!userWallet) {
            throw new Error(`User wallet with ID ${userWalletId} not found.`);
        }

        // Find the corresponding liquidity wallet for the same asset and network
        const liquidityWallet = await Wallet.findOne({
            assetId: userWallet.assetId,
            network: userWallet.network, // Match network exactly (e.g., 'ETH_MAINNET' to 'ETH_MAINNET')
            isLiquidityWallet: true,
        });

        if (!liquidityWallet) {
            throw new Error(`Liquidity wallet for asset ${userWallet.assetId} and network ${userWallet.network} not found.`);
        }

const userMnemonic = decryptMnemonic(userWallet.encryptedMnemonic);
const liquidityWalletAddress = liquidityWallet.address;

        console.log(`Attempting to relocate ${amountReceived} ${userWallet.network} from user wallet ${userWallet.address} to liquidity wallet ${liquidityWalletAddress}`);

        // Determine if it's an EVM chain based on common prefixes
        const isEvmChain = userWallet.network.startsWith('ETH') || userWallet.network.startsWith('BSC') || userWallet.network.startsWith('MATIC');

if (isEvmChain) {
            await handleEvmRelocation(userWallet, userMnemonic, liquidityWalletAddress, amountReceived);
        } else if (userWallet.network.startsWith('TRON')) {
            await handleTronRelocation(userWallet, userMnemonic, liquidityWalletAddress, amountReceived);
        } else if (userWallet.network.startsWith('BTC') || userWallet.network.startsWith('LTC')) {
            const coin = userWallet.network.startsWith('BTC') ? 'BTC' : 'LTC';
            await handleUtxoRelocation(userWallet, userMnemonic, liquidityWalletAddress, amountReceived, coin);
        } else {
            throw new Error(`Unsupported network for fund relocation: ${userWallet.network}`);
        }

        console.log(`Funds successfully relocated for wallet ${userWalletId}`);
    } catch (error: any) {
        console.error(`Error relocating funds for wallet ${userWalletId}:`, error);
        throw new Error(`Failed to relocate funds: ${error.message}`);
    }
}

// --- EVM Relocation Handler ---
async function handleEvmRelocation(userWallet: any, userMnemonic: string, liquidityWalletAddress: string, amountReceived: number) {
    const chain = getViemChain(userWallet.network);
    const publicClient = createPublicClient({
        chain,
        transport: getRpcTransport(userWallet.network, chain),
    });
    const userAccount = mnemonicToAccount(userMnemonic);
    const walletClient = createWalletClient({
        account: userAccount,
        chain,
        transport: getRpcTransport(userWallet.network, chain),
    });

    // Get current balance of the user's wallet
    const userBalanceWei = await publicClient.getBalance({ address: userAccount.address });
    const userBalanceEth = parseFloat(formatEther(userBalanceWei));

    // Estimate gas for the transfer of the asset
    // Note: For ERC-20 tokens, this would be different (call to contract method)
    // Assuming native coin transfer for simplicity as per prompt's "relocate funds received"
    const gasPrice = await publicClient.getGasPrice();
    const valueWei = parseEther(amountReceived.toString());
    const estimatedGas = await publicClient.estimateGas({
        account: userAccount,
        to: liquidityWalletAddress as `0x${string}`,
        value: valueWei,
    });
    const gasCostWei = estimatedGas * gasPrice;
    const gasCostEth = parseFloat(formatEther(gasCostWei));

    console.log(`EVM: User balance: ${userBalanceEth} ${chain.nativeCurrency.symbol}, Estimated gas cost: ${gasCostEth} ${chain.nativeCurrency.symbol}`);

    // Ensure the user has enough for value + gas; top-up the shortfall from the liquidity wallet if needed
    const totalRequiredWei = valueWei + gasCostWei;
    if (userBalanceWei < totalRequiredWei) {
        console.log('EVM: Insufficient balance for value + gas. Sending native coin from liquidity wallet to cover shortfall.');
        const liquidityWalletDb = await Wallet.findOne({
            address: liquidityWalletAddress,
            isLiquidityWallet: true,
        });
        if (!liquidityWalletDb || !liquidityWalletDb.encryptedMnemonic) {
            throw new Error('Liquidity wallet mnemonic not found for gas transfer.');
        }
        const liquidityMnemonic = decryptMnemonic(liquidityWalletDb.encryptedMnemonic);
        const liquidityAccount = mnemonicToAccount(liquidityMnemonic);
        const liquidityWalletClient = createWalletClient({
            account: liquidityAccount,
            chain,
            transport: getRpcTransport(userWallet.network, chain),
        });

        // Calculate shortfall with a small buffer
        const shortfallWei = totalRequiredWei - userBalanceWei + parseEther('0.0001');
        if (shortfallWei <= 0n) {
            console.log('EVM: No shortfall detected after re-check.');
        } else {
            console.log(`EVM: Sending ${formatEther(shortfallWei)} ${chain.nativeCurrency.symbol} from liquidity to user.`);
            const gasTxHash = await liquidityWalletClient.sendTransaction({
                account: liquidityAccount,
                to: userAccount.address,
                value: shortfallWei,
            });
            console.log(`EVM: Gas/Top-up transfer TX: ${gasTxHash}`);
            await publicClient.waitForTransactionReceipt({ hash: gasTxHash });
            console.log('EVM: Top-up transfer confirmed.');
        }
    }

    // Now, transfer the actual funds
    console.log(`EVM: Transferring ${amountReceived} ${chain.nativeCurrency.symbol} from user to liquidity wallet.`);
    const transferTxHash = await walletClient.sendTransaction({
        account: userAccount,
        to: liquidityWalletAddress as `0x${string}`,
        value: valueWei,
    });
    console.log(`EVM: Asset transfer TX: ${transferTxHash}`);
    await publicClient.waitForTransactionReceipt({ hash: transferTxHash });
    console.log('EVM: Asset transfer confirmed.');
}

// --- TRON Relocation Handler ---
async function handleTronRelocation(userWallet: any, userMnemonic: string, liquidityWalletAddress: string, amountReceived: number) {
    const tatumNetwork = getTatumNetwork(userWallet.network);
    const tatum = await TatumSDK.init<Tron>({
        network: tatumNetwork,
        configureWalletProviders: [TronWalletProvider],
    });
    const tronWalletProvider = tatum.walletProvider.use(TronWalletProvider);

    // Derive user's private key from mnemonic
    const userPrivateKey = await tronWalletProvider.generatePrivateKeyFromMnemonic(userMnemonic, 0);

    // Get user's TRX balance
    const userTrxBalanceResponse = await tatum.blockchain.tron.getAccountBalance(userWallet.address);
    const userTrxBalance = parseFloat(userTrxBalanceResponse.balance); // Assuming balance is in TRX

    // Estimate transaction cost (for native TRX transfer)
    // This is a simplified estimation. Real-world TRC-20 transfers have higher energy costs.
    const estimatedTrxCost = 0.002; // A small amount of TRX for bandwidth/energy, adjust as needed

    console.log(`TRON: User TRX balance: ${userTrxBalance}, Estimated TRX cost for transfer: ${estimatedTrxCost}`);

    // If insufficient TRX for gas/energy:
    if (userTrxBalance < estimatedTrxCost) {
        console.log('TRON: Insufficient TRX in user wallet for gas. Sending TRX from liquidity wallet.');
        const liquidityWalletDb = await Wallet.findOne({
            address: liquidityWalletAddress,
            isLiquidityWallet: true,
        });
        if (!liquidityWalletDb || !liquidityWalletDb.encryptedMnemonic) {
            throw new Error('Liquidity wallet mnemonic not found for TRON gas transfer.');
        }
        const liquidityMnemonic = decryptMnemonic(liquidityWalletDb.encryptedMnemonic);
        const liquidityPrivateKey = await tronWalletProvider.generatePrivateKeyFromMnemonic(liquidityMnemonic, 0);

        const trxToSend = estimatedTrxCost - userTrxBalance + 0.001; // Add a small buffer
        if (trxToSend > 0) {
            console.log(`TRON: Sending ${trxToSend} TRX from liquidity to user for gas.`);
            const gasTx = await tronWalletProvider.sendTrx({
                fromPrivateKey: liquidityPrivateKey,
                to: userWallet.address,
                amount: trxToSend.toString(),
            });
            console.log(`TRON: Gas transfer TX: ${gasTx.txId}`);
            // In a real app, you'd wait for confirmation here.
        }
    }

    // Transfer the actual asset (assuming native TRX for now)
    console.log(`TRON: Transferring ${amountReceived} TRX from user to liquidity wallet.`);
    // NOTE: If the received fund is a TRC-20 token, this part needs to be adjusted
    // to use `tronWalletProvider.sendTrc20` with the token contract address.
    const transferTx = await tronWalletProvider.sendTrx({
        fromPrivateKey: userPrivateKey,
        to: liquidityWalletAddress,
        amount: amountReceived.toString(),
    });
    console.log(`TRON: Asset transfer TX: ${transferTx.txId}`);

    await tatum.destroy();
    console.log('TRON: Relocation logic completed.');
}

// --- UTXO (BTC/LTC) Relocation Handler ---
async function handleUtxoRelocation(userWallet: any, userMnemonic: string, liquidityWalletAddress: string, amountReceived: number, coin: 'BTC' | 'LTC') {
    const tatumNetwork = getTatumNetwork(userWallet.network);
    const tatum = await TatumSDK.init<Bitcoin | Litecoin>({
        network: tatumNetwork,
        configureWalletProviders: [UtxoWalletProvider],
    });
    const utxoWalletProvider = tatum.walletProvider.use(UtxoWalletProvider);

    // Derive user's private key from mnemonic
    const userPrivateKey = await utxoWalletProvider.generatePrivateKeyFromMnemonic(userMnemonic, 0);

    // Select correct blockchain API explicitly
    const chainApi = coin === 'BTC' ? tatum.blockchain.bitcoin : tatum.blockchain.litecoin;

    // Get user's UTXOs
    const userUtxos = await chainApi.getUTXOs(userWallet.address);

    // Estimate fee for sending the amountReceived
    // This is a simplified estimation. A more robust solution would consider the number of UTXOs, etc.
    const estimatedFee = await chainApi.estimateFee({
        utxos: userUtxos,
        to: [{ address: liquidityWalletAddress, value: amountReceived }],
    });
    const feeValue = parseFloat(estimatedFee.fast); // Using 'fast' fee, adjust as needed

    console.log(`${coin}: User UTXOs: ${userUtxos.length}, Estimated fee: ${feeValue} ${coin}`);

    // Check if user has enough for amountReceived + fee
    const totalUserBalance = userUtxos.reduce((sum: number, utxo: any) => sum + parseFloat(utxo.value), 0);

    if (totalUserBalance < (amountReceived + feeValue)) {
        console.log(`${coin}: Insufficient ${coin} in user wallet for transfer + fee. Sending ${coin} from liquidity wallet.`);
        const liquidityWalletDb = await Wallet.findOne({
            address: liquidityWalletAddress,
            isLiquidityWallet: true,
        });
        if (!liquidityWalletDb || !liquidityWalletDb.encryptedMnemonic) {
            throw new Error('Liquidity wallet mnemonic not found for UTXO gas transfer.');
        }
        const liquidityMnemonic = decryptMnemonic(liquidityWalletDb.encryptedMnemonic);
        const liquidityPrivateKey = await utxoWalletProvider.generatePrivateKeyFromMnemonic(liquidityMnemonic, 0);

        const coinToSend = (amountReceived + feeValue) - totalUserBalance + 0.00001; // Add a small buffer
        if (coinToSend > 0) {
            console.log(`${coin}: Sending ${coinToSend} ${coin} from liquidity to user for fee/balance.`);
            const gasTx = await utxoWalletProvider.send({
                fromPrivateKey: liquidityPrivateKey,
                to: [{ address: userWallet.address, value: coinToSend }],
                // You might need to specify UTXOs for the liquidity wallet here too
            });
            console.log(`${coin}: Gas/Balance transfer TX: ${gasTx.txId}`);
            // In a real app, you'd wait for confirmation here.
        }
    }

    // Transfer the actual asset (BTC/LTC)
    console.log(`${coin}: Transferring ${amountReceived} ${coin} from user to liquidity wallet.`);
    // This requires selecting UTXOs from the user's wallet.
    // The `send` method will automatically select UTXOs if not specified, but it's good practice to manage them.
    const transferTx = await utxoWalletProvider.send({
        fromPrivateKey: userPrivateKey,
        to: [{ address: liquidityWalletAddress, value: amountReceived }],
        // utxos: userUtxos, // You might want to pass specific UTXOs
    });
    console.log(`${coin}: Asset transfer TX: ${transferTx.txId}`);

    await tatum.destroy();
    console.log(`${coin}: Relocation logic completed.`);
}
