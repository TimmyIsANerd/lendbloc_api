import { TatumSDK, Network, type Tron, type Bitcoin, type Litecoin } from '@tatumio/tatum';
import { TronWalletProvider } from '@tatumio/tron-wallet-provider';
import { UtxoWalletProvider } from '@tatumio/utxo-wallet-provider';

const TEST_ENV: boolean = process.env.CURRENT_ENVIRONMENT === "DEVELOPMENT";


/**
 * Generates a new TRON wallet with mnemonic, private key, and address
 * @async
 * @returns {Promise<{
 *   address: string,
 *   privateKey: string,
 *   mnemonic: string
 * }>} An object containing the generated wallet details
 * @throws {Error} If there's an error during wallet generation
 * @example
 * const wallet = await generateTronWallet();
 * // Returns: { address: 'T...', privateKey: '...', mnemonic: '...' }
 */

export const generateTronWallet = async () => {
    const tatum = await TatumSDK.init<Tron>({
        network: Network.TRON,
        configureWalletProviders: [TronWalletProvider],
    });

    const tronWallet = tatum.walletProvider.use(TronWalletProvider)

    // Generate Mnemonic
    const mnemonic = await tronWallet.generateMnemonic();

    // Private Key
    const privateKey = await tronWallet.generatePrivateKeyFromMnemonic(mnemonic, 0);

    // Address
    const address = await tronWallet.generateAddressFromMnemonic(mnemonic, 0);

    await tatum.destroy();

    return {
        address,
        privateKey,
        mnemonic,
    }
}

/**
 * Generates a new Bitcoin wallet with mnemonic, private key, and address
 * @async
 * @returns {Promise<{
 *   address: string,
 *   privateKey: string,
 *   mnemonic: string
 * }>} An object containing the generated wallet details
 * @throws {Error} If there's an error during wallet generation or Tatum SDK initialization
 * @example
 * const wallet = await generateBtcWallet();
 * // Returns: { address: 'bc1...', privateKey: '...', mnemonic: '...' }
 */
export const generateBtcWallet = async () => {
    const tatum = await TatumSDK.init<Bitcoin>({
        network: TEST_ENV ? Network.BITCOIN_TESTNET_4 : Network.BITCOIN,
        configureWalletProviders: [UtxoWalletProvider],
    });

    const btcWallet = tatum.walletProvider.use(UtxoWalletProvider);

    // Generate Mnemonic
    const mnemonic = await btcWallet.generateMnemonic();

    // Private Key
    const privateKey = await btcWallet.generatePrivateKeyFromMnemonic(mnemonic, 0);

    // Address
    const address = await btcWallet.generateAddressFromMnemonic(mnemonic, 0);

    await tatum.destroy();

    return {
        address,
        privateKey,
        mnemonic,
    }
}

/**
 * Generates a new Litecoin (LTC) wallet with mnemonic, private key, and address
 * @async
 * @returns {Promise<{
 *   address: string,
 *   privateKey: string,
 *   mnemonic: string
 * }>} An object containing the generated wallet details
 * @throws {Error} If there's an error during wallet generation or Tatum SDK initialization
 * @example
 * const wallet = await generateLTCWallet();
 * // Returns: { address: 'L...', privateKey: '...', mnemonic: '...' }
 */
export const generateLTCWallet = async () => {
    const tatum = await TatumSDK.init<Litecoin>({
        network: TEST_ENV ? Network.LITECOIN_TESTNET : Network.LITECOIN,
        configureWalletProviders: [UtxoWalletProvider],
    });

    const ltcWallet = tatum.walletProvider.use(UtxoWalletProvider);

    // Generate Mnemonic
    const mnemonic = await ltcWallet.generateMnemonic();

    // Private Key
    const privateKey = await ltcWallet.generatePrivateKeyFromMnemonic(mnemonic, 0);

    // Address
    const address = await ltcWallet.generateAddressFromMnemonic(mnemonic, 0);

    await tatum.destroy();

    return {
        address,
        privateKey,
        mnemonic,
    }
}