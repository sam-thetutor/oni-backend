import crypto from 'crypto';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
function uint8ArrayToHex(bytes) {
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function hexToUint8Array(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}
function bufferToUint8Array(buffer) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
export class EncryptionService {
    static encryptPrivateKey(privateKey, password) {
        try {
            const saltBuffer = crypto.randomBytes(SALT_LENGTH);
            const salt = bufferToUint8Array(saltBuffer);
            const keyBuffer = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
            const key = bufferToUint8Array(keyBuffer);
            const ivBuffer = crypto.randomBytes(IV_LENGTH);
            const iv = bufferToUint8Array(ivBuffer);
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            cipher.setAAD(salt);
            let encrypted = cipher.update(privateKey, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const tagBuffer = cipher.getAuthTag();
            const tag = bufferToUint8Array(tagBuffer);
            const saltHex = uint8ArrayToHex(salt);
            const ivHex = uint8ArrayToHex(iv);
            const tagHex = uint8ArrayToHex(tag);
            const result = saltHex + ':' + ivHex + ':' + tagHex + ':' + encrypted;
            return result;
        }
        catch (error) {
            console.error('Error encrypting private key:', error);
            throw new Error('Failed to encrypt private key');
        }
    }
    static decryptPrivateKey(encryptedData, password) {
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 4) {
                throw new Error('Invalid encrypted data format');
            }
            const [saltHex, ivHex, tagHex, encrypted] = parts;
            const salt = hexToUint8Array(saltHex);
            const iv = hexToUint8Array(ivHex);
            const tag = hexToUint8Array(tagHex);
            const keyBuffer = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
            const key = bufferToUint8Array(keyBuffer);
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAAD(salt);
            decipher.setAuthTag(tag);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            console.error('Error decrypting private key:', error);
            throw new Error('Failed to decrypt private key');
        }
    }
    static isEncrypted(data) {
        if (data.startsWith('$2')) {
            return false;
        }
        const parts = data.split(':');
        return parts.length === 4;
    }
    static async migrateFromBcrypt(bcryptHash, password) {
        throw new Error('Cannot migrate from bcrypt hash - private key is not recoverable');
    }
}
//# sourceMappingURL=encryption.js.map