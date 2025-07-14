import express from 'express';
import { PriceCacheService } from '../services/price-cache.js';

const router = express.Router();

// Get market data for a specific coin (with 30-minute caching)
router.get('/market/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const data = await PriceCacheService.getMarketData(coinId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Get chart data for a specific coin (with 30-minute caching)
router.get('/chart/:coinId', async (req, res) => {
  try {
    const { coinId } = req.params;
    const days = Number(req.query.days) || 7;
    
    console.log(`🔍 API Request: /chart/${coinId}?days=${days}`);
    console.log(`📋 Query params:`, req.query);
    console.log(`🔢 Parsed days: ${days} (type: ${typeof days})`);
    
    const data = await PriceCacheService.getChartData(coinId, days);
    
    console.log(`📊 Returning chart data:`, {
      coinId,
      days,
      dataLength: data?.prices?.length || 0,
      firstPrice: data?.prices?.[0],
      lastPrice: data?.prices?.[data?.prices?.length - 1],
      priceRange: data?.prices ? [
        Math.min(...data.prices.map((p: any) => p[1])),
        Math.max(...data.prices.map((p: any) => p[1]))
      ] : null
    });
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// Clear expired cache entries (admin endpoint)
router.post('/clear-cache', async (req, res) => {
  try {
    await PriceCacheService.clearExpiredCache();
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export { router as priceDataRoutes }; 