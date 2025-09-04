import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, This is a standard IV length

const masterKey = Buffer.from(process.env.MASTER_ENCRYPTION_KEY!, 'hex');

if (!process.env.MASTER_ENCRYPTION_KEY || masterKey.length !== 32) {
    throw new Error("Invalid MASTER_ENCRYPTION_KEY. It must be a 32-byte hex string.");
}

/**
 * Encrypts a text string (e.g., a mnemonic phrase).
 * @param text The plaintext to encrypt.
 * @returns A hex-encoded string containing the iv and the encrypted text.
 */
export function encryptMnemonic(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Combine iv, tag, and the encrypted data for easy storage in a single DB field
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
}

/**
 * Decrypts a hex-encoded string back to the original mnemonic.
 * @param encryptedHex The hex string from the encryptMnemonic function.
 * @returns The original decrypted text.
 */
export function decryptMnemonic(encryptedHex: string): string {
    const data = Buffer.from(encryptedHex, 'hex');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encryptedText = data.subarray(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString('utf8');
}