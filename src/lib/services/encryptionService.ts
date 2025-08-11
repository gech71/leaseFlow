
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY = process.env.ENCRYPTION_KEY;

if (!KEY || KEY.length !== 64) {
    if (process.env.NODE_ENV === 'production') {
        console.error("FATAL: ENCRYPTION_KEY is not set or is not a 64-character hex string. This is required for production.");
    } else {
        console.warn("WARN: ENCRYPTION_KEY is not set or is not a 64-character hex string. Encryption will fail.");
    }
}

class EncryptionService {
  private getKey(): Buffer {
    if (!KEY || KEY.length !== 64) {
      throw new Error('Encryption key is not set or is invalid. It must be a 32-byte (64-character) hex string.');
    }
    return Buffer.from(KEY, 'hex');
  }

  encrypt(text: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
  }

  decrypt(encryptedText: string): string {
    const key = this.getKey();
    const data = Buffer.from(encryptedText, 'hex');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted, 'hex', 'utf8'), decipher.final('utf8')]);
    return decrypted.toString();
  }
}

export const encryptionService = new EncryptionService();
