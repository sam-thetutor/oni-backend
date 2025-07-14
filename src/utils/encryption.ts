import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Helper function to convert Uint8Array to hex string
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Helper function to convert Buffer to Uint8Array
function bufferToUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

export class EncryptionService {
  /**
   * Encrypt a private key
   */
  static encryptPrivateKey(privateKey: string, password: string): string {
    try {
      // Generate a random salt and convert to Uint8Array
      const saltBuffer = crypto.randomBytes(SALT_LENGTH);
      const salt = bufferToUint8Array(saltBuffer);
      
      // Derive key from password using PBKDF2 and convert to Uint8Array
      const keyBuffer = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
      const key = bufferToUint8Array(keyBuffer);
      
      // Generate a random IV and convert to Uint8Array
      const ivBuffer = crypto.randomBytes(IV_LENGTH);
      const iv = bufferToUint8Array(ivBuffer);
      
      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      cipher.setAAD(salt);
      
      // Encrypt the private key
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the auth tag and convert to Uint8Array
      const tagBuffer = cipher.getAuthTag();
      const tag = bufferToUint8Array(tagBuffer);
      
      // Combine salt + iv + tag + encrypted data using Uint8Array
      const saltHex = uint8ArrayToHex(salt);
      const ivHex = uint8ArrayToHex(iv);
      const tagHex = uint8ArrayToHex(tag);
      
      const result = saltHex + ':' + ivHex + ':' + tagHex + ':' + encrypted;
      
      return result;
    } catch (error) {
      console.error('Error encrypting private key:', error);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypt a private key
   */
  static decryptPrivateKey(encryptedData: string, password: string): string {
    try {
      // Split the encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
      }
      
      const [saltHex, ivHex, tagHex, encrypted] = parts;
      
      // Convert hex strings back to Uint8Array
      const salt = hexToUint8Array(saltHex);
      const iv = hexToUint8Array(ivHex);
      const tag = hexToUint8Array(tagHex);
      
      // Derive key from password using PBKDF2 and convert to Uint8Array
      const keyBuffer = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
      const key = bufferToUint8Array(keyBuffer);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAAD(salt);
      decipher.setAuthTag(tag);
      
      // Decrypt the private key
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error decrypting private key:', error);
      throw new Error('Failed to decrypt private key');
    }
  }

  /**
   * Check if a string is encrypted (not a bcrypt hash)
   */
  static isEncrypted(data: string): boolean {
    // Check if it's a bcrypt hash (starts with $2)
    if (data.startsWith('$2')) {
      return false; // This is a bcrypt hash, not our encryption
    }
    
    // Check if it's our encryption format (should have 4 parts separated by :)
    const parts = data.split(':');
    return parts.length === 4;
  }

  /**
   * Migrate bcrypt hash to encrypted format (for existing users)
   */
  static async migrateFromBcrypt(bcryptHash: string, password: string): Promise<string> {
    // For bcrypt hashes, we can't decrypt them, so we need to generate a new private key
    // This is a limitation - we can't recover the original private key from bcrypt
    throw new Error('Cannot migrate from bcrypt hash - private key is not recoverable');
  }
} 