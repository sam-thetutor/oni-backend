-- Supabase Migration Script for Oni Backend
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    privy_id TEXT UNIQUE NOT NULL,
    email TEXT,
    wallet_address TEXT UNIQUE NOT NULL,
    frontend_wallet_address TEXT UNIQUE NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    points INTEGER DEFAULT 0 NOT NULL,
    total_volume DECIMAL(20, 8) DEFAULT 0 NOT NULL,
    weekly_points INTEGER DEFAULT 0,
    weekly_volume DECIMAL(20, 8) DEFAULT 0,
    username TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create payment_links table
CREATE TABLE IF NOT EXISTS payment_links (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    link_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(privy_id) ON DELETE CASCADE,
    amount DECIMAL(20, 8),
    is_global BOOLEAN DEFAULT false NOT NULL,
    is_paid BOOLEAN DEFAULT false NOT NULL,
    paid_amount DECIMAL(20, 8),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create dca_orders table
CREATE TABLE IF NOT EXISTS dca_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(privy_id) ON DELETE CASCADE,
    from_token TEXT NOT NULL,
    to_token TEXT NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    trigger_price DECIMAL(20, 8) NOT NULL,
    trigger_type TEXT CHECK (trigger_type IN ('above', 'below')) NOT NULL,
    status TEXT CHECK (status IN ('active', 'executed', 'cancelled', 'failed', 'expired')) DEFAULT 'active' NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    transaction_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create price_data table for caching
CREATE TABLE IF NOT EXISTS price_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    token_symbol TEXT NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    source TEXT NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_privy_id ON users(privy_id);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_frontend_wallet_address ON users(frontend_wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE INDEX IF NOT EXISTS idx_payment_links_link_id ON payment_links(link_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_user_id ON payment_links(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_is_paid ON payment_links(is_paid);

CREATE INDEX IF NOT EXISTS idx_dca_orders_user_id ON dca_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_dca_orders_status ON dca_orders(status);
CREATE INDEX IF NOT EXISTS idx_dca_orders_trigger_price ON dca_orders(trigger_price);

CREATE INDEX IF NOT EXISTS idx_price_data_token_symbol ON price_data(token_symbol);
CREATE INDEX IF NOT EXISTS idx_price_data_timestamp ON price_data(timestamp);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_links_updated_at BEFORE UPDATE ON payment_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dca_orders_updated_at BEFORE UPDATE ON dca_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE dca_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_data ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (auth.uid()::text = privy_id);

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (auth.uid()::text = privy_id);

CREATE POLICY "Service role can access all users" ON users
    FOR ALL USING (auth.role() = 'service_role');

-- Create policies for payment_links table
CREATE POLICY "Users can view their own payment links" ON payment_links
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create their own payment links" ON payment_links
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own payment links" ON payment_links
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Anyone can view public payment links" ON payment_links
    FOR SELECT USING (true);

CREATE POLICY "Service role can access all payment links" ON payment_links
    FOR ALL USING (auth.role() = 'service_role');

-- Create policies for dca_orders table
CREATE POLICY "Users can view their own DCA orders" ON dca_orders
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create their own DCA orders" ON dca_orders
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own DCA orders" ON dca_orders
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Service role can access all DCA orders" ON dca_orders
    FOR ALL USING (auth.role() = 'service_role');

-- Create policies for price_data table
CREATE POLICY "Anyone can view price data" ON price_data
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage price data" ON price_data
    FOR ALL USING (auth.role() = 'service_role');

-- Insert some sample data for testing (optional)
-- INSERT INTO users (privy_id, wallet_address, frontend_wallet_address, encrypted_private_key) 
-- VALUES ('test-user', '0x1234567890123456789012345678901234567890', '0x0987654321098765432109876543210987654321', 'encrypted-key-here'); 