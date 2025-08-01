import { config } from 'dotenv';
config();
const isProduction = process.env.ENVIRONMENT === 'production';
export const TOKEN_ADDRESSES = {
    XFI: isProduction
        ? "0x0000000000000000000000000000000000000000"
        : "0x0000000000000000000000000000000000000000",
    CFI: isProduction
        ? "0x0000000000000000000000000000000000000000"
        : "0x0000000000000000000000000000000000000000",
    WXFI: isProduction
        ? "0xC537D12bd626B135B251cCa43283EFF69eC109c4"
        : "0xC537D12bd626B135B251cCa43283EFF69eC109c4",
    FOMO: isProduction
        ? "0x608A092CDa76620C06bD9d75b1D1719cdC36600f"
        : "0x608A092CDa76620C06bD9d75b1D1719cdC36600f",
    WETH: isProduction
        ? "0xa084d905e3F35C6B86B5E672C2e72b0472ddA1e3"
        : "0xa084d905e3F35C6B86B5E672C2e72b0472ddA1e3",
    USDC: isProduction
        ? "0x7bBcE15166bBc008EC1aDF9b3D6bbA0602FCE7Ba"
        : "0x7bBcE15166bBc008EC1aDF9b3D6bbA0602FCE7Ba",
    WBTC: isProduction
        ? "0x417c85B9D0826501d7399FEeF417656774d333cc"
        : "0x417c85B9D0826501d7399FEeF417656774d333cc",
    USDT: isProduction
        ? "0x38E88b1ed92065eD20241A257ef3713A131C9155"
        : "0x38E88b1ed92065eD20241A257ef3713A131C9155",
    BNB: isProduction
        ? "0x40F6226bB42E440655D5741Eb62eE95d0159F344"
        : "0x40F6226bB42E440655D5741Eb62eE95d0159F344",
    SOL: isProduction
        ? "0x5b9bec66bB3d1559Fc6E05bfCAE7a1b5cdf678BE"
        : "0x5b9bec66bB3d1559Fc6E05bfCAE7a1b5cdf678BE",
    XUSD: isProduction
        ? "0x979B05E391c3544824E7EC19d064Ae4f0198741c"
        : "0x979B05E391c3544824E7EC19d064Ae4f0198741c",
};
export const TOKEN_METADATA = {
    XFI: {
        symbol: 'XFI',
        name: isProduction ? 'CrossFi Token' : 'Test CrossFi Token',
        decimals: 18,
        isNative: true,
        address: TOKEN_ADDRESSES.XFI,
    },
    CFI: {
        symbol: 'CFI',
        name: isProduction ? 'CrossFi Token' : 'Test CrossFi Token',
        decimals: 18,
        isNative: true,
        address: TOKEN_ADDRESSES.CFI,
    },
    WXFI: {
        symbol: 'WXFI',
        name: isProduction ? 'Wrapped XFI' : 'Test Wrapped XFI',
        decimals: 18,
        isNative: false,
        address: TOKEN_ADDRESSES.WXFI,
    },
    FOMO: {
        symbol: 'FOMO',
        name: isProduction ? 'Fear of Missing Out' : 'Test Fear of Missing Out',
        decimals: 18,
        isNative: false,
        address: TOKEN_ADDRESSES.FOMO,
    },
    WETH: {
        symbol: 'WETH',
        name: isProduction ? 'Wrapped Ether' : 'Test Wrapped Ether',
        decimals: 18,
        isNative: false,
        address: TOKEN_ADDRESSES.WETH,
    },
    USDC: {
        symbol: 'USDC',
        name: isProduction ? 'USD Coin' : 'Test USD Coin',
        decimals: 6,
        isNative: false,
        address: TOKEN_ADDRESSES.USDC,
    },
    WBTC: {
        symbol: 'WBTC',
        name: isProduction ? 'Wrapped BTC' : 'Test Wrapped BTC',
        decimals: 8,
        isNative: false,
        address: TOKEN_ADDRESSES.WBTC,
    },
    USDT: {
        symbol: 'USDT',
        name: isProduction ? 'Tether USD' : 'Test Tether USD',
        decimals: 6,
        isNative: false,
        address: TOKEN_ADDRESSES.USDT,
    },
    BNB: {
        symbol: 'BNB',
        name: isProduction ? 'BNB' : 'Test BNB',
        decimals: 18,
        isNative: false,
        address: TOKEN_ADDRESSES.BNB,
    },
    SOL: {
        symbol: 'SOL',
        name: isProduction ? 'SOL' : 'Test SOL',
        decimals: 9,
        isNative: false,
        address: TOKEN_ADDRESSES.SOL,
    },
    XUSD: {
        symbol: 'XUSD',
        name: isProduction ? 'XUSD' : 'Test XUSD',
        decimals: 18,
        isNative: false,
        address: TOKEN_ADDRESSES.XUSD,
    },
};
export const SUPPORTED_DCA_PAIRS = [
    {
        from: 'USDC',
        to: 'XFI',
        description: 'Buy XFI with USDC',
        minAmount: '1',
        maxAmount: '10000',
    },
    {
        from: 'XFI',
        to: 'USDC',
        description: 'Sell XFI for USDC',
        minAmount: '0.1',
        maxAmount: '1000',
    }
];
export const DCA_CONFIG = {
    MIN_AMOUNT: 0.001,
    MAX_AMOUNT: 1000,
    MIN_INTERVAL_HOURS: 1,
    MAX_INTERVAL_HOURS: 168,
    DEFAULT_INTERVAL_HOURS: 24,
    MAX_RETRIES: 3,
};
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
    DEFAULT_SLIPPAGE: 5,
    MIN_SLIPPAGE: 0.1,
    MAX_SLIPPAGE: 50,
    GAS_LIMIT_MULTIPLIER: 1.2,
    MAX_GAS_PRICE_GWEI: 100,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_SECONDS: 5,
    DEADLINE_MINUTES: 20,
    SUPPORTED_TOKENS: ['CFI', 'WXFI', 'FOMO', 'WETH', 'USDC', 'WBTC', 'BNB', 'SOL', 'XUSD'],
};
export function getTokenByAddress(address) {
    return Object.values(TOKEN_METADATA).find(token => token.address.toLowerCase() === address.toLowerCase());
}
export function getTokenBySymbol(symbol) {
    return TOKEN_METADATA[symbol];
}
export function validateAmount(amount) {
    return amount >= DCA_CONFIG.MIN_AMOUNT && amount <= DCA_CONFIG.MAX_AMOUNT;
}
export function validateInterval(hours) {
    return hours >= DCA_CONFIG.MIN_INTERVAL_HOURS && hours <= DCA_CONFIG.MAX_INTERVAL_HOURS;
}
export function validateSlippage(slippage) {
    return slippage >= DCA_LIMITS.MIN_SLIPPAGE && slippage <= DCA_LIMITS.MAX_SLIPPAGE;
}
export function validateTriggerPrice(price) {
    return price >= DCA_LIMITS.MIN_TRIGGER_PRICE && price <= DCA_LIMITS.MAX_TRIGGER_PRICE;
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
export function isSupportedPair(fromSymbol, toSymbol) {
    return SUPPORTED_DCA_PAIRS.some(pair => pair.from === fromSymbol && pair.to === toSymbol);
}
export function getPairConfig(fromSymbol, toSymbol) {
    return SUPPORTED_DCA_PAIRS.find(pair => pair.from === fromSymbol && pair.to === toSymbol);
}
export function validateSwapSlippage(slippage) {
    return slippage >= SWAP_CONFIG.MIN_SLIPPAGE && slippage <= SWAP_CONFIG.MAX_SLIPPAGE;
}
export function isSupportedSwapToken(symbol) {
    return SWAP_CONFIG.SUPPORTED_TOKENS.includes(symbol);
}
//# sourceMappingURL=tokens.js.map