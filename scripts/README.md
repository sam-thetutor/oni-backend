# Scripts Directory

This directory contains utility scripts for managing the BUAI backend system.

## Directory Structure

```
scripts/
├── README.md
└── database/
    ├── preview-reset.js
    ├── reset-testnet-db.js
    └── reset-production-db.js
```

## Database Scripts

### `database/preview-reset.js`
**Purpose**: Preview what will be deleted before resetting the database
**Usage**: 
```bash
# Using npm script (recommended)
npm run db:preview

# Or directly
node scripts/database/preview-reset.js
```
**What it does**:
- Connects to MongoDB
- Lists all collections and their document counts
- Shows summary of what will be deleted
- Does NOT actually delete anything

### `database/reset-testnet-db.js`
**Purpose**: Completely reset the testnet database
**Usage**: 
```bash
# Using npm script (recommended)
npm run db:reset

# Or directly
node scripts/database/reset-testnet-db.js
```
**What it does**:
- Connects to MongoDB
- Lists all collections
- Drops all collections and their data
- Resets the database to a clean state
- ⚠️ **WARNING**: This permanently deletes all data!

### `database/reset-production-db.js`
**Purpose**: Safely reset the production database with multiple confirmations
**Usage**: 
```bash
# Using npm script (recommended)
npm run db:reset:prod

# Or directly
node scripts/database/reset-production-db.js
```
**What it does**:
- Checks environment (warns if not production)
- Shows detailed collection and document counts
- Requires multiple user confirmations
- Final confirmation requires typing "RESET-PRODUCTION"
- Drops all collections and their data
- Verifies the reset was successful
- 🚨 **EXTREME WARNING**: This permanently deletes all production data!

## Usage Examples

### 1. Check current database state
```bash
npm run db:preview
```

### 2. Reset database (after confirming with preview)
```bash
npm run db:reset
```

### 3. Verify reset was successful
```bash
npm run db:preview
```

### 4. Reset production database (with safety checks)
```bash
npm run db:reset:prod
```

## Safety Notes

- Always run `preview-reset.js` first to see what will be deleted
- Make sure no backend services are running when resetting
- The reset script will drop ALL collections and data
- Indexes will be recreated automatically when first user connects

## NPM Scripts

For convenience, the following npm scripts are available:

- `npm run db:preview` - Preview database state before reset
- `npm run db:reset` - Reset the testnet database
- `npm run db:reset:prod` - Reset the production database (with safety checks)
- `npm run test:funding` - Test wallet funding setup and configuration

## Environment Requirements

- `MONGODB_URI` environment variable must be set
- Node.js with ES modules support
- MongoDB connection access 