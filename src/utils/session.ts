import { config } from 'dotenv';
import crypto from 'crypto';

config();

// Helper function to convert base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decrypt data using the session key
export async function decryptForTransaction(
  encryptedData: string,
  iv: string,
  sessionKey: string
): Promise<string> {
  try {
    // Convert base64 strings to Uint8Array
    const encryptedUint8 = base64ToUint8Array(encryptedData);
    const ivUint8 = base64ToUint8Array(iv);
    const keyUint8 = base64ToUint8Array(sessionKey);

    // Extract the auth tag (last 16 bytes) and ciphertext
    const authTag = encryptedUint8.slice(encryptedUint8.length - 16);
    const ciphertext = encryptedUint8.slice(0, encryptedUint8.length - 16);

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyUint8, ivUint8);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    const decrypted = decipher.update(ciphertext);
    const final = decipher.final();
    
    // Combine the decrypted parts
    const result = new Uint8Array(decrypted.length + final.length);
    result.set(decrypted, 0);
    result.set(final, decrypted.length);

    return new TextDecoder().decode(result);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
} 