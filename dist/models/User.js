import mongoose, { Schema } from 'mongoose';
import { config } from 'dotenv';
import { EncryptionService } from '../utils/encryption.js';
config();
const UserSchema = new Schema({
    privyId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    email: {
        type: String,
        required: false,
    },
    walletAddress: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    frontendWalletAddress: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    encryptedPrivateKey: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        index: true,
    },
    points: {
        type: Number,
        required: true,
        default: 0,
    },
    totalVolume: {
        type: Number,
        required: true,
        default: 0,
    },
    weeklyPoints: {
        type: Number,
        required: false,
        default: 0,
    },
    weeklyVolume: {
        type: Number,
        required: false,
        default: 0,
    },
}, {
    timestamps: true,
});
UserSchema.index({ privyId: 1, walletAddress: 1 });
UserSchema.methods.comparePrivateKey = async function (privateKey) {
    if (this.encryptedPrivateKey.startsWith('$2')) {
        const bcrypt = await import('bcryptjs');
        return bcrypt.compare(privateKey, this.encryptedPrivateKey);
    }
    try {
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY not set');
        }
        const decrypted = EncryptionService.decryptPrivateKey(this.encryptedPrivateKey, encryptionKey);
        return decrypted === privateKey;
    }
    catch (error) {
        return false;
    }
};
UserSchema.methods.addPoints = async function (points) {
    this.points += points;
    await this.save();
};
UserSchema.methods.addVolume = async function (amount) {
    this.totalVolume += amount;
    await this.save();
};
UserSchema.methods.addWeeklyPoints = async function (points) {
    this.weeklyPoints = (this.weeklyPoints || 0) + points;
    await this.save();
};
UserSchema.methods.addWeeklyVolume = async function (amount) {
    this.weeklyVolume = (this.weeklyVolume || 0) + amount;
    await this.save();
};
UserSchema.pre('save', async function (next) {
    if (this.isModified('encryptedPrivateKey')) {
        if (!EncryptionService.isEncrypted(this.encryptedPrivateKey)) {
            const encryptionKey = process.env.ENCRYPTION_KEY;
            if (!encryptionKey) {
                throw new Error('ENCRYPTION_KEY environment variable is required');
            }
            this.encryptedPrivateKey = EncryptionService.encryptPrivateKey(this.encryptedPrivateKey, encryptionKey);
        }
    }
    next();
});
export const User = mongoose.model('User', UserSchema);
//# sourceMappingURL=User.js.map