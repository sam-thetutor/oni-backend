import { PriceData } from '../models/PriceData.js';
const CACHE_DURATION = 30 * 60 * 1000;
export class PriceCacheService {
    static async getMarketData(coinId) {
        try {
            const cachedData = await PriceData.findOne({
                coinId,
                dataType: 'market',
                expiresAt: { $gt: new Date() }
            });
            if (cachedData) {
                console.log(`📦 Using cached market data for ${coinId}`);
                return cachedData.data;
            }
            console.log(`🔄 Fetching fresh market data for ${coinId}`);
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`);
            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status}`);
            }
            const data = await response.json();
            await this.storeMarketData(coinId, data);
            return data;
        }
        catch (error) {
            console.error('Error fetching market data:', error);
            const fallbackData = await PriceData.findOne({
                coinId,
                dataType: 'market'
            }).sort({ fetchedAt: -1 });
            if (fallbackData) {
                console.log(`⚠️ Using expired cache as fallback for ${coinId}`);
                return fallbackData.data;
            }
            return this.getSampleMarketData(coinId);
        }
    }
    static async getChartData(coinId, days = 7) {
        try {
            const cacheKey = `${coinId}-${days}d`;
            const cachedData = await PriceData.findOne({
                coinId: cacheKey,
                dataType: 'chart',
                expiresAt: { $gt: new Date() }
            });
            if (cachedData) {
                console.log(`📦 Using cached chart data for ${coinId} (${days} days)`);
                return cachedData.data;
            }
            console.log(`🔄 Fetching fresh chart data for ${coinId} (${days} days)`);
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status}`);
            }
            const data = await response.json();
            await this.storeChartData(cacheKey, data);
            return data;
        }
        catch (error) {
            console.error(`Error fetching chart data for ${coinId} (${days} days):`, error);
            const cacheKey = `${coinId}-${days}d`;
            const fallbackData = await PriceData.findOne({
                coinId: cacheKey,
                dataType: 'chart'
            }).sort({ fetchedAt: -1 });
            if (fallbackData) {
                console.log(`⚠️ Using expired cache as fallback for ${coinId} (${days} days)`);
                return fallbackData.data;
            }
            return this.getSampleChartData(days);
        }
    }
    static async storeMarketData(coinId, data) {
        const expiresAt = new Date(Date.now() + CACHE_DURATION);
        await PriceData.findOneAndUpdate({ coinId, dataType: 'market' }, {
            coinId,
            dataType: 'market',
            data,
            fetchedAt: new Date(),
            expiresAt
        }, { upsert: true, new: true });
        console.log(`💾 Cached market data for ${coinId} until ${expiresAt.toISOString()}`);
    }
    static async storeChartData(cacheKey, data) {
        const expiresAt = new Date(Date.now() + CACHE_DURATION);
        await PriceData.findOneAndUpdate({ coinId: cacheKey, dataType: 'chart' }, {
            coinId: cacheKey,
            dataType: 'chart',
            data,
            fetchedAt: new Date(),
            expiresAt
        }, { upsert: true, new: true });
        console.log(`💾 Cached chart data for ${cacheKey} until ${expiresAt.toISOString()}`);
    }
    static getSampleMarketData(coinId) {
        console.log(`🔄 Returning sample market data for ${coinId}`);
        return {
            id: coinId,
            symbol: 'xfi',
            name: 'CrossFi',
            market_data: {
                current_price: { usd: 0.082 },
                market_cap: { usd: 3460000 },
                total_volume: { usd: 125000 },
                price_change_24h: 0.0045,
                price_change_percentage_24h: 5.8,
                market_cap_rank: 1250,
                ath: { usd: 0.15 },
                ath_change_percentage: { usd: -45.3 },
                ath_date: { usd: '2024-01-15T00:00:00.000Z' },
                atl: { usd: 0.025 },
                atl_change_percentage: { usd: 228.0 },
                atl_date: { usd: '2023-11-20T00:00:00.000Z' }
            }
        };
    }
    static getSampleChartData(days = 7) {
        console.log(`🔄 Returning sample chart data for ${days} days`);
        const prices = [];
        const market_caps = [];
        const total_volumes = [];
        const now = Date.now();
        const dataPoints = Math.min(days, 365);
        console.log(`📊 Generating ${dataPoints} data points for ${days} days`);
        const basePrice = 0.082;
        let currentPrice = basePrice;
        for (let i = dataPoints - 1; i >= 0; i--) {
            const timestamp = now - (i * 24 * 60 * 60 * 1000);
            const trendDirection = Math.sin(i / 10) * 0.3;
            const dailyChange = (Math.random() - 0.5) * 0.006;
            const priceMovement = (trendDirection + dailyChange) * currentPrice;
            currentPrice = Math.max(0.020, currentPrice + priceMovement);
            currentPrice = Math.min(0.150, currentPrice);
            prices.push([timestamp, Number(currentPrice.toFixed(6))]);
            market_caps.push([timestamp, Number((currentPrice * 42195122).toFixed(0))]);
            total_volumes.push([timestamp, 125000 + (Math.random() * 50000)]);
        }
        console.log(`💰 Sample price range: $${Math.min(...prices.map(p => p[1])).toFixed(4)} - $${Math.max(...prices.map(p => p[1])).toFixed(4)}`);
        return {
            prices,
            market_caps,
            total_volumes
        };
    }
    static async clearExpiredCache() {
        try {
            const result = await PriceData.deleteMany({
                expiresAt: { $lt: new Date() }
            });
            if (result.deletedCount > 0) {
                console.log(`🗑️ Cleared ${result.deletedCount} expired cache entries`);
            }
        }
        catch (error) {
            console.error('Error clearing expired cache:', error);
        }
    }
}
//# sourceMappingURL=price-cache.js.map