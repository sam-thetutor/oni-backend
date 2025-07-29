import { config } from 'dotenv';
config();
const isProduction = process.env.ENVIRONMENT === 'production';
export const TOKEN_ADDRESSES = {
    XFI: '0x0000000000000000000000000000000000000000',
    tUSDC: isProduction
        ? '0x0000000000000000000000000000000000000000'
        : '0xc5C6691c4A6264eF595F1fdEBc7AC077bdD1Ee50',
};
export const TOKEN_METADATA = {
    XFI: {
        symbol: 'XFI',
        name: 'CrossFi',
        decimals: 18,
        isNative: true,
        address: TOKEN_ADDRESSES.XFI,
    },
    tUSDC: {
        symbol: 'tUSDC',
        name: isProduction ? 'USD Coin' : 'Test USD Coin',
        decimals: 18,
        isNative: false,
        address: TOKEN_ADDRESSES.tUSDC,
    }
};
export const SUPPORTED_DCA_PAIRS = [
    {
        from: 'tUSDC',
        to: 'XFI',
        description: 'Buy XFI with tUSDC',
        minAmount: '1',
        maxAmount: '10000',
    },
    {
        from: 'XFI',
        to: 'tUSDC',
        description: 'Sell XFI for tUSDC',
        minAmount: '0.1',
        maxAmount: '1000',
    }
];
export const DCA_LIMITS = {
    MAX_ORDERS_PER_USER: 10,
    MIN_TRIGGER_PRICE: 0.001,
    MAX_TRIGGER_PRICE: 1000,
    MIN_SLIPPAGE: 0.1,
    MAX_SLIPPAGE: 50,
    DEFAULT_SLIPPAGE: 5,
    MAX_ORDER_LIFETIME_DAYS: 365,
    EXECUTION_TIMEOUT_MINUTES: 10,
};
export const PRICE_CONFIG = {
    XFI_PRICE_DECIMALS: 8,
    UPDATE_INTERVAL_SECONDS: 30,
    PRICE_TOLERANCE: 0.001,
};
export const SWAP_CONFIG = {
    GAS_LIMIT_MULTIPLIER: 1.2,
    MAX_GAS_PRICE_GWEI: 100,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_SECONDS: 5,
};
export function getTokenByAddress(address) {
    return Object.values(TOKEN_METADATA).find(token => token.address.toLowerCase() === address.toLowerCase());
}
export function getTokenBySymbol(symbol) {
    return TOKEN_METADATA[symbol];
}
export function isSupportedPair(fromSymbol, toSymbol) {
    return SUPPORTED_DCA_PAIRS.some(pair => pair.from === fromSymbol && pair.to === toSymbol);
}
export function getPairConfig(fromSymbol, toSymbol) {
    return SUPPORTED_DCA_PAIRS.find(pair => pair.from === fromSymbol && pair.to === toSymbol);
}
export function validateTokenAmount(symbol, amount) {
    const token = getTokenBySymbol(symbol);
    if (!token)
        return false;
    const numAmount = parseFloat(amount);
    const pair = SUPPORTED_DCA_PAIRS.find(p => p.from === symbol);
    if (!pair)
        return false;
    return numAmount >= parseFloat(pair.minAmount) && numAmount <= parseFloat(pair.maxAmount);
}
export function validateTriggerPrice(price) {
    return price >= DCA_LIMITS.MIN_TRIGGER_PRICE && price <= DCA_LIMITS.MAX_TRIGGER_PRICE;
}
export function validateSlippage(slippage) {
    return slippage >= DCA_LIMITS.MIN_SLIPPAGE && slippage <= DCA_LIMITS.MAX_SLIPPAGE;
}
//# sourceMappingURL=tokens.js.map