import { createEvmWalletWithViem } from "./evm";
import { generateTronWallet, generateBtcWallet, generateLTCWallet } from "./non-evm";
import { encryptMnemonic } from "./security";
import Wallet from "../../models/Wallet";
import Asset from "../../models/Asset"; // Assuming Asset model exists

export const initializeWalletSystem = async (userId: string) => {
    try {
        // Generate EVM Wallet
        const evmWallet = createEvmWalletWithViem();
        const encryptedEvmMnemonic = encryptMnemonic(evmWallet.mnemonic);
        const evmAsset = await Asset.findOneAndUpdate(
            { symbol: 'ETH', name: 'Ethereum' }, // Assuming ETH is the primary asset for EVM
            { $setOnInsert: { symbol: 'ETH', name: 'Ethereum', type: 'crypto' } },
            { upsert: true, new: true }
        );
        await Wallet.create({
            userId,
            assetId: evmAsset._id,
            address: evmWallet.address,
            encryptedMnemonic: encryptedEvmMnemonic,
            network: 'ETH',
            balance: 0,
        });
        console.log(`EVM Wallet created for user ${userId}: ${evmWallet.address}`);

        // Generate TRON Wallet
        const tronWallet = await generateTronWallet();
        const encryptedTronMnemonic = encryptMnemonic(tronWallet.mnemonic);
        const tronAsset = await Asset.findOneAndUpdate(
            { symbol: 'TRX', name: 'Tron' }, // Assuming TRX is the primary asset for TRON
            { $setOnInsert: { symbol: 'TRX', name: 'Tron', type: 'crypto' } },
            { upsert: true, new: true }
        );
        await Wallet.create({
            userId,
            assetId: tronAsset._id,
            address: tronWallet.address,
            encryptedMnemonic: encryptedTronMnemonic,
            network: 'TRON',
            balance: 0,
        });
        console.log(`TRON Wallet created for user ${userId}: ${tronWallet.address}`);

        // Generate BTC Wallet
        const btcWallet = await generateBtcWallet();
        const encryptedBtcMnemonic = encryptMnemonic(btcWallet.mnemonic);
        const btcAsset = await Asset.findOneAndUpdate(
            { symbol: 'BTC', name: 'Bitcoin' }, // Assuming BTC is the primary asset for Bitcoin
            { $setOnInsert: { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' } },
            { upsert: true, new: true }
        );
        await Wallet.create({
            userId,
            assetId: btcAsset._id,
            address: btcWallet.address,
            encryptedMnemonic: encryptedBtcMnemonic,
            network: 'BTC',
            balance: 0,
        });
        console.log(`BTC Wallet created for user ${userId}: ${btcWallet.address}`);

        // Generate LTC Wallet
        const ltcWallet = await generateLTCWallet();
        const encryptedLtcMnemonic = encryptMnemonic(ltcWallet.mnemonic);
        const ltcAsset = await Asset.findOneAndUpdate(
            { symbol: 'LTC', name: 'Litecoin' }, // Assuming LTC is the primary asset for Litecoin
            { $setOnInsert: { symbol: 'LTC', name: 'Litecoin', type: 'crypto' } },
            { upsert: true, new: true }
        );
        await Wallet.create({
            userId,
            assetId: ltcAsset._id,
            address: ltcWallet.address,
            encryptedMnemonic: encryptedLtcMnemonic,
            network: 'LTC',
            balance: 0,
        });
        console.log(`LTC Wallet created for user ${userId}: ${ltcWallet.address}`);

        console.log(`All wallets initialized for user ${userId}`);
    } catch (error: any) {
        console.error(`Error initializing wallets for user ${userId}:`, error);
        throw new Error(`Failed to initialize wallets: ${error.message}`);
    }
};
