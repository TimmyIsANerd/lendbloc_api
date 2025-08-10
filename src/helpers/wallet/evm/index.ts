import { generateMnemonic, mnemonicToAccount, english } from 'viem/accounts';


/**
 * Generates a new EVM-compatible wallet using viem.
 * This function creates a mnemonic and derives the primary account from it.
 * @returns An object containing the address, private key, and the mnemonic phrase.
 */
export function createEvmWalletWithViem() {
    // 1. Generate a new, secure mnemonic phrase
    const mnemonic = generateMnemonic(english);

    // 2. Derive the account from the mnemonic
    // By default, this uses the standard Ethereum derivation path m/44'/60'/0'/0/0
    const account = mnemonicToAccount(mnemonic);

    return {
        address: account.address,
        privateKey: account.getHdKey().privateKey,
        mnemonic: mnemonic, // This is what you will encrypt and store
    };
}

