import { PriceData } from '../models/PriceData.js';

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

export class PriceCacheService {
  /**
   * Get cached market data or fetch from API if expired
   */
  static async getMarketData(coinId: string): Promise<any> {
    try {
      // Check for cached data
      const cachedData = await PriceData.findOne({
        coinId,
        dataType: 'market',
        expiresAt: { $gt: new Date() }
      });

      if (cachedData) {
        console.log(`📦 Using cached market data for ${coinId}`);
        return cachedData.data;
      }

      // Fetch fresh data from CoinGecko
      console.log(`🔄 Fetching fresh market data for ${coinId}`);
      const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`);
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Store in cache
      await this.storeMarketData(coinId, data);
      
      return data;
    } catch (error) {
      console.error('Error fetching market data:', error);
      
      // Try to get any cached data as fallback (even if expired)
      const fallbackData = await PriceData.findOne({
        coinId,
        dataType: 'market'
      }).sort({ fetchedAt: -1 });

      if (fallbackData) {
        console.log(`⚠️ Using expired cache as fallback for ${coinId}`);
        return fallbackData.data;
      }

      // Return sample data if no cache available
      return this.getSampleMarketData(coinId);
    }
  }

  /**
   * Get cached chart data or fetch from API if expired
   */
  static async getChartData(coinId: string, days: number = 7): Promise<any> {
    try {
      // Create timeframe-specific cache key
      const cacheKey = `${coinId}-${days}d`;
      
      // Check for cached data with timeframe
      const cachedData = await PriceData.findOne({
        coinId: cacheKey,
        dataType: 'chart',
        expiresAt: { $gt: new Date() }
      });

      if (cachedData) {
        console.log(`📦 Using cached chart data for ${coinId} (${days} days)`);
        return cachedData.data;
      }

      // Fetch fresh data from CoinGecko
      console.log(`🔄 Fetching fresh chart data for ${coinId} (${days} days)`);
      const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`);
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Store in cache with timeframe
      await this.storeChartData(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error(`Error fetching chart data for ${coinId} (${days} days):`, error);
      
      // Create timeframe-specific cache key for fallback
      const cacheKey = `${coinId}-${days}d`;
      
      // Try to get any cached data as fallback (even if expired)
      const fallbackData = await PriceData.findOne({
        coinId: cacheKey,
        dataType: 'chart'
      }).sort({ fetchedAt: -1 });

      if (fallbackData) {
        console.log(`⚠️ Using expired cache as fallback for ${coinId} (${days} days)`);
        return fallbackData.data;
      }

      // Return sample data if no cache available
      return this.getSampleChartData(days);
    }
  }

  /**
   * Store market data in cache
   */
  private static async storeMarketData(coinId: string, data: any): Promise<void> {
    const expiresAt = new Date(Date.now() + CACHE_DURATION);
    
    await PriceData.findOneAndUpdate(
      { coinId, dataType: 'market' },
      {
        coinId,
        dataType: 'market',
        data,
        fetchedAt: new Date(),
        expiresAt
      },
      { upsert: true, new: true }
    );

    console.log(`💾 Cached market data for ${coinId} until ${expiresAt.toISOString()}`);
  }

  /**
   * Store chart data in cache
   */
  private static async storeChartData(cacheKey: string, data: any): Promise<void> {
    const expiresAt = new Date(Date.now() + CACHE_DURATION);
    
    await PriceData.findOneAndUpdate(
      { coinId: cacheKey, dataType: 'chart' },
      {
        coinId: cacheKey,
        dataType: 'chart',
        data,
        fetchedAt: new Date(),
        expiresAt
      },
      { upsert: true, new: true }
    );

    console.log(`💾 Cached chart data for ${cacheKey} until ${expiresAt.toISOString()}`);
  }

  /**
   * Get sample market data for fallback
   */
  private static getSampleMarketData(coinId: string): any {
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

  /**
   * Get sample chart data for fallback
   */
  private static getSampleChartData(days: number = 7): any {
    console.log(`🔄 Returning sample chart data for ${days} days`);
    const prices = [];
    const market_caps = [];
    const total_volumes = [];
    const now = Date.now();
    
    // Generate data points based on the requested timeframe
    const dataPoints = Math.min(days, 365); // Cap at 365 days for performance
    
    console.log(`📊 Generating ${dataPoints} data points for ${days} days`);
    
    // Create more realistic price progression with less random variation
    const basePrice = 0.082;
    let currentPrice = basePrice;
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const timestamp = now - (i * 24 * 60 * 60 * 1000);
      
      // Smaller, more realistic price movements
      const trendDirection = Math.sin(i / 10) * 0.3; // Gentle trend
      const dailyChange = (Math.random() - 0.5) * 0.006; // ±0.3% max daily change
      const priceMovement = (trendDirection + dailyChange) * currentPrice;
      
      currentPrice = Math.max(0.020, currentPrice + priceMovement); // Floor at $0.02
      currentPrice = Math.min(0.150, currentPrice); // Ceiling at $0.15
      
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

  /**
   * Clear expired cache entries
   */
  static async clearExpiredCache(): Promise<void> {
    try {
      const result = await PriceData.deleteMany({
        expiresAt: { $lt: new Date() }
      });
      
      if (result.deletedCount > 0) {
        console.log(`🗑️ Cleared ${result.deletedCount} expired cache entries`);
      }
    } catch (error) {
      console.error('Error clearing expired cache:', error);
    }
  }
} 