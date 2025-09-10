import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes IV for GCM

function getMasterKey(): Buffer {
  const keyHex = process.env.MASTER_ENCRYPTION_KEY;
  if (!keyHex) throw new Error('MASTER_ENCRYPTION_KEY is not set');
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('MASTER_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('hex');
}

export function decryptSecret(cipherHex: string): string {
  const key = getMasterKey();
  const data = Buffer.from(cipherHex, 'hex');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
  const enc = data.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
  return decrypted.toString('utf8');
}
