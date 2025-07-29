import mongoose, { Document, Schema } from 'mongoose';
import { config } from 'dotenv';
import { EncryptionService } from '../utils/encryption.js';

// Load environment variables
config();

export interface IUser extends Document {
  privyId: string;
  email?: string;
  walletAddress: string;
  frontendWalletAddress: string;
  encryptedPrivateKey: string;
  points: number;
  totalVolume: number;
  weeklyPoints?: number;
  weeklyVolume?: number;
  createdAt: Date;
  updatedAt: Date;
  username?: string;
  
  // Methods
  comparePrivateKey(privateKey: string): Promise<boolean>;
  addPoints(points: number): Promise<void>;
  addVolume(amount: number): Promise<void>;
  addWeeklyPoints(points: number): Promise<void>;
  addWeeklyVolume(amount: number): Promise<void>;
}

const UserSchema = new Schema<IUser>({
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

// Index for efficient queries
UserSchema.index({ privyId: 1, walletAddress: 1 });

// Method to compare private key (for legacy bcrypt hashes)
UserSchema.methods.comparePrivateKey = async function(privateKey: string): Promise<boolean> {
  // Check if it's a legacy bcrypt hash
  if (this.encryptedPrivateKey.startsWith('$2')) {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(privateKey, this.encryptedPrivateKey);
  }
  
  // For new encryption, we can't compare directly, so we'll try to decrypt
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not set');
    }
    
    const decrypted = EncryptionService.decryptPrivateKey(this.encryptedPrivateKey, encryptionKey);
    return decrypted === privateKey;
  } catch (error) {
    return false;
  }
};

// Method to add points to user
UserSchema.methods.addPoints = async function(points: number): Promise<void> {
  this.points += points;
  await this.save();
};

// Method to add volume to user
UserSchema.methods.addVolume = async function(amount: number): Promise<void> {
  this.totalVolume += amount;
  await this.save();
};

// Method to add weekly points to user
UserSchema.methods.addWeeklyPoints = async function(points: number): Promise<void> {
  this.weeklyPoints = (this.weeklyPoints || 0) + points;
  await this.save();
};

// Method to add weekly volume to user
UserSchema.methods.addWeeklyVolume = async function(amount: number): Promise<void> {
  this.weeklyVolume = (this.weeklyVolume || 0) + amount;
  await this.save();
};

// Pre-save middleware to encrypt private key
UserSchema.pre('save', async function(next) {
  if (this.isModified('encryptedPrivateKey')) {
    // If the private key is being set for the first time, encrypt it
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

export const User = mongoose.model<IUser>('User', UserSchema); 