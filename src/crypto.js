import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const SALT_LEN = 16;
const IV_LEN = 12;
const KEY_LEN = 32;
const SCRYPT_OPTS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, KEY_LEN, SCRYPT_OPTS);
}

/**
 * Encrypts a Buffer with AES-256-GCM. Output layout:
 * [salt(16)][iv(12)][authTag(16)][ciphertext...]
 * A fresh salt+iv is generated per call so encrypting the same plaintext
 * twice never produces the same bytes.
 */
export function encryptBuffer(plaintext, passphrase) {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, ciphertext]);
}

/**
 * Reverses encryptBuffer. Throws if the passphrase is wrong or the data
 * was tampered with (GCM auth tag mismatch) — never silently returns
 * garbage.
 */
export function decryptBuffer(encrypted, passphrase) {
  const salt = encrypted.subarray(0, SALT_LEN);
  const iv = encrypted.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const authTag = encrypted.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + 16);
  const ciphertext = encrypted.subarray(SALT_LEN + IV_LEN + 16);

  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Decryption failed — wrong passphrase or corrupted backup.');
  }
}
