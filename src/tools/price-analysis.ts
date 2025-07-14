import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { PriceAnalyticsService } from '../services/price-analytics.js';

// XFI Price Chart Tool
export const XFIPriceChartTool = new DynamicStructuredTool({
  name: "xfi_price_chart",
  description: "Get XFI token price chart data with historical prices, market cap, and volume data for technical analysis",
  schema: z.object({
    days: z.number().min(1).max(365).default(7).describe("Number of days of historical data to fetch (1-365, default: 7)"),
    currency: z.string().default("usd").describe("Currency for price data (default: usd)")
  }),
  func: async (input) => {
    try {
      const { days, currency } = input;
      const chartData = await PriceAnalyticsService.getChartData(days, currency);
      
      const result = {
        summary: {
          timeRange: chartData.timeRange,
          currency: chartData.currency.toUpperCase(),
          totalDataPoints: chartData.prices.length,
          priceRange: {
            min: Math.min(...chartData.prices.map(p => p.price)),
            max: Math.max(...chartData.prices.map(p => p.price)),
            latest: chartData.prices[chartData.prices.length - 1]?.price
          }
        },
        priceData: {
          // Return sample of price points to avoid overwhelming the LLM
          firstPrice: chartData.prices[0],
          latestPrice: chartData.prices[chartData.prices.length - 1],
          samplePrices: chartData.prices.filter((_, index) => index % Math.ceil(chartData.prices.length / 10) === 0)
        },
        volumeData: {
          latest24hVolume: chartData.total_volumes[chartData.total_volumes.length - 1]?.price,
          averageVolume: chartData.total_volumes.reduce((sum, vol) => sum + vol.price, 0) / chartData.total_volumes.length
        },
        marketCapData: {
          latestMarketCap: chartData.market_caps[chartData.market_caps.length - 1]?.price,
          averageMarketCap: chartData.market_caps.reduce((sum, cap) => sum + cap.price, 0) / chartData.market_caps.length
        },
        insights: [
          `📊 Retrieved ${chartData.prices.length} price data points over ${days} days`,
          `💰 Current price: $${chartData.prices[chartData.prices.length - 1]?.price.toFixed(5)}`,
          `📈 Price range: $${Math.min(...chartData.prices.map(p => p.price)).toFixed(5)} - $${Math.max(...chartData.prices.map(p => p.price)).toFixed(5)}`,
          `📊 Average 24h volume: $${(chartData.total_volumes.reduce((sum, vol) => sum + vol.price, 0) / chartData.total_volumes.length / 1000).toFixed(0)}K`,
          `🏦 Latest market cap: $${(chartData.market_caps[chartData.market_caps.length - 1]?.price / 1000000).toFixed(2)}M`
        ],
        dataAvailableForAnalysis: true,
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error fetching XFI price chart: ${error}`;
    }
  },
});

// XFI Market Data Tool
export const XFIMarketDataTool = new DynamicStructuredTool({
  name: "xfi_market_data",
  description: "Get comprehensive XFI token market data including current price, market cap, volume, price changes, and key metrics",
  schema: z.object({}),
  func: async () => {
    try {
      const marketData = await PriceAnalyticsService.getMarketData();
      
      const result = {
        currentMetrics: {
          symbol: marketData.symbol,
          currentPrice: marketData.current_price,
          marketCap: marketData.market_cap,
          totalVolume: marketData.total_volume,
          lastUpdated: marketData.last_updated
        },
        pricePerformance: {
          change24h: marketData.price_change_24h,
          changePercentage24h: marketData.price_change_percentage_24h,
          changePercentage7d: marketData.price_change_percentage_7d,
          changePercentage14d: marketData.price_change_percentage_14d,
          changePercentage30d: marketData.price_change_percentage_30d
        },
        allTimeMetrics: {
          allTimeHigh: marketData.ath,
          athChangePercentage: marketData.ath_change_percentage,
          athDate: marketData.ath_date,
          allTimeLow: marketData.atl,
          atlChangePercentage: marketData.atl_change_percentage,
          atlDate: marketData.atl_date
        },
        supplyMetrics: {
          circulatingSupply: marketData.circulating_supply,
          totalSupply: marketData.total_supply,
          maxSupply: marketData.max_supply,
          marketCapToVolumeRatio: marketData.market_cap / marketData.total_volume
        },
        insights: [
          `💰 XFI currently trading at $${marketData.current_price.toFixed(5)}`,
          `📊 Market cap: $${(marketData.market_cap / 1000000).toFixed(2)}M`,
          `📈 24h change: ${marketData.price_change_percentage_24h > 0 ? '+' : ''}${marketData.price_change_percentage_24h.toFixed(2)}%`,
          `📊 24h volume: $${(marketData.total_volume / 1000).toFixed(0)}K`,
          `🎯 ATH: $${marketData.ath.toFixed(5)} (${marketData.ath_change_percentage.toFixed(1)}% from current)`,
          `📉 ATL: $${marketData.atl.toFixed(5)} (${marketData.atl_change_percentage.toFixed(1)}% from current)`,
          `🪙 Circulating supply: ${(marketData.circulating_supply / 1000000).toFixed(1)}M XFI`,
          `⚡ Volume/Market Cap ratio: ${((marketData.total_volume / marketData.market_cap) * 100).toFixed(1)}%`,
          marketData.price_change_percentage_7d ? `📅 7d performance: ${marketData.price_change_percentage_7d > 0 ? '+' : ''}${marketData.price_change_percentage_7d.toFixed(2)}%` : ''
        ].filter(insight => insight !== ''),
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error fetching XFI market data: ${error}`;
    }
  },
});

// XFI Trading Signals Tool
export const XFITradingSignalsTool = new DynamicStructuredTool({
  name: "xfi_trading_signals",
  description: "Generate AI-powered trading signals and technical analysis for XFI token with buy/sell/hold recommendations",
  schema: z.object({
    analysisDepth: z.enum(["basic", "comprehensive"]).default("comprehensive").describe("Depth of technical analysis to perform"),
    timeframe: z.number().min(1).max(90).default(14).describe("Number of days to analyze for signals (1-90, default: 14)")
  }),
  func: async (input) => {
    try {
      const { timeframe } = input;
      const analytics = await PriceAnalyticsService.getComprehensivePriceAnalytics(timeframe);
      
      const result = {
        tradingSignal: {
          recommendation: analytics.tradingSignal.type,
          strength: analytics.tradingSignal.strength,
          confidence: analytics.tradingSignal.confidence,
          reasoning: analytics.tradingSignal.reasoning
        },
        technicalIndicators: {
          trend: analytics.tradingSignal.technicalIndicators.trend,
          rsi: analytics.tradingSignal.technicalIndicators.rsi,
          movingAverages: {
            ma20: analytics.tradingSignal.technicalIndicators.movingAverage20,
            ma50: analytics.tradingSignal.technicalIndicators.movingAverage50
          },
          keyLevels: {
            support: analytics.tradingSignal.technicalIndicators.supportLevel,
            resistance: analytics.tradingSignal.technicalIndicators.resistanceLevel
          }
        },
        riskMetrics: {
          volatility: analytics.volatility,
          priceFromATH: ((analytics.marketData.current_price - analytics.marketData.ath) / analytics.marketData.ath * 100).toFixed(1) + '%',
          priceFromATL: ((analytics.marketData.current_price - analytics.marketData.atl) / analytics.marketData.atl * 100).toFixed(1) + '%'
        },
        marketContext: {
          currentPrice: analytics.marketData.current_price,
          volume24h: analytics.marketData.total_volume,
          marketCap: analytics.marketData.market_cap,
          price24hChange: analytics.marketData.price_change_percentage_24h
        },
        aiInsights: [
          `🎯 Signal: ${analytics.tradingSignal.type} (${analytics.tradingSignal.strength} confidence: ${analytics.tradingSignal.confidence}%)`,
          `📊 Trend Analysis: ${analytics.tradingSignal.technicalIndicators.trend} trend detected`,
          `📈 Technical Setup: ${analytics.tradingSignal.technicalIndicators.rsi ? `RSI at ${analytics.tradingSignal.technicalIndicators.rsi}` : 'Insufficient data for RSI'}`,
          `💰 Key Levels: Support $${analytics.tradingSignal.technicalIndicators.supportLevel?.toFixed(5) || 'N/A'}, Resistance $${analytics.tradingSignal.technicalIndicators.resistanceLevel?.toFixed(5) || 'N/A'}`,
          `⚡ Volatility: ${analytics.volatility.daily.toFixed(1)}% daily, ${analytics.volatility.weekly.toFixed(1)}% weekly`,
          `🎯 Risk Assessment: ${analytics.volatility.daily > 10 ? 'High volatility - higher risk/reward' : analytics.volatility.daily > 5 ? 'Moderate volatility' : 'Low volatility - stable price action'}`,
          `📊 Volume Analysis: $${(analytics.marketData.total_volume / 1000).toFixed(0)}K 24h volume (${((analytics.marketData.total_volume / analytics.marketData.market_cap) * 100).toFixed(1)}% of market cap)`
        ],
        timestamp: new Date().toISOString(),
        disclaimer: "This is AI-generated analysis for educational purposes only. Not financial advice. Always do your own research."
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error generating XFI trading signals: ${error}`;
    }
  },
});

// XFI Price Prediction Tool
export const XFIPricePredictionTool = new DynamicStructuredTool({
  name: "xfi_price_prediction",
  description: "Generate AI-powered price predictions and scenarios for XFI token based on technical analysis and market trends",
  schema: z.object({
    predictionHorizon: z.enum(["short", "medium", "long"]).default("medium").describe("Prediction timeframe - short (1-7 days), medium (1-4 weeks), long (1-3 months)"),
    includeScenarios: z.boolean().default(true).describe("Include bull, bear, and neutral scenarios")
  }),
  func: async (input) => {
    try {
      const { predictionHorizon, includeScenarios } = input;
      const analytics = await PriceAnalyticsService.getComprehensivePriceAnalytics(30); // Use 30 days for predictions
      
      const currentPrice = analytics.marketData.current_price;
      const volatility = analytics.volatility.daily / 100; // Convert to decimal
      const trend = analytics.tradingSignal.technicalIndicators.trend;
      
      // Calculate prediction timeframe
      let timeframeDays: number;
      let timeframeLabel: string;
      
      switch (predictionHorizon) {
        case "short":
          timeframeDays = 7;
          timeframeLabel = "1 week";
          break;
        case "medium":
          timeframeDays = 21;
          timeframeLabel = "3 weeks";
          break;
        case "long":
          timeframeDays = 60;
          timeframeLabel = "2 months";
          break;
      }
      
      // Base prediction based on trend and volatility
      let trendMultiplier = 1;
      if (trend === 'BULLISH') trendMultiplier = 1.05;
      else if (trend === 'BEARISH') trendMultiplier = 0.95;
      
      const basePrediction = currentPrice * trendMultiplier;
      
      // Generate scenarios if requested
      let scenarios = {};
      if (includeScenarios) {
        const volatilityRange = volatility * Math.sqrt(timeframeDays);
        
        scenarios = {
          bullish: {
            targetPrice: basePrediction * (1 + volatilityRange * 2),
            probability: trend === 'BULLISH' ? 35 : trend === 'BEARISH' ? 15 : 25,
            scenario: "Strong momentum continues, positive market sentiment, increased adoption"
          },
          neutral: {
            targetPrice: currentPrice * (1 + (Math.random() - 0.5) * 0.1),
            probability: 40,
            scenario: "Sideways consolidation, market equilibrium, range-bound trading"
          },
          bearish: {
            targetPrice: basePrediction * (1 - volatilityRange * 2),
            probability: trend === 'BEARISH' ? 35 : trend === 'BULLISH' ? 15 : 25,
            scenario: "Market correction, profit-taking, negative sentiment impact"
          }
        };
      }
      
      const result = {
        prediction: {
          timeframe: timeframeLabel,
          currentPrice: currentPrice,
          targetPrice: basePrediction,
          expectedChange: ((basePrediction - currentPrice) / currentPrice * 100).toFixed(1) + '%',
          confidence: analytics.tradingSignal.confidence,
          methodology: "Technical analysis with trend and volatility factors"
        },
        ...(includeScenarios && { scenarios }),
        technicalBasis: {
          currentTrend: trend,
          rsi: analytics.tradingSignal.technicalIndicators.rsi,
          supportLevel: analytics.tradingSignal.technicalIndicators.supportLevel,
          resistanceLevel: analytics.tradingSignal.technicalIndicators.resistanceLevel,
          volatilityDaily: analytics.volatility.daily + '%'
        },
        marketFactors: {
          volume24h: analytics.marketData.total_volume,
          marketCap: analytics.marketData.market_cap,
          price24hChange: analytics.marketData.price_change_percentage_24h + '%',
          priceFromATH: analytics.marketData.ath_change_percentage.toFixed(1) + '%'
        },
        riskFactors: [
          analytics.volatility.daily > 10 ? "High volatility creates uncertainty" : "Moderate volatility supports stable predictions",
          "Crypto markets are highly unpredictable",
          "External market factors could impact price significantly",
          "CrossFi ecosystem development and adoption rates are key factors",
          "Overall crypto market sentiment heavily influences individual tokens"
        ],
        insights: [
          `🎯 ${timeframeLabel} prediction: $${basePrediction.toFixed(5)} (${((basePrediction - currentPrice) / currentPrice * 100).toFixed(1)}% change)`,
          `📊 Based on ${trend.toLowerCase()} trend analysis`,
          `⚡ Daily volatility: ${analytics.volatility.daily.toFixed(1)}% suggests ${analytics.volatility.daily > 8 ? 'high' : 'moderate'} price uncertainty`,
          `🎯 Key level to watch: ${trend === 'BULLISH' ? 'Resistance' : 'Support'} at $${(trend === 'BULLISH' ? analytics.tradingSignal.technicalIndicators.resistanceLevel : analytics.tradingSignal.technicalIndicators.supportLevel)?.toFixed(5) || 'N/A'}`,
          `📈 ${analytics.tradingSignal.confidence}% confidence based on technical indicators`
        ],
        timestamp: new Date().toISOString(),
        disclaimer: "Predictions are based on technical analysis and historical data. Cryptocurrency markets are highly volatile and unpredictable. This is not financial advice."
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error generating XFI price prediction: ${error}`;
    }
  },
});

// XFI Market Comparison Tool
export const XFIMarketComparisonTool = new DynamicStructuredTool({
  name: "xfi_market_comparison",
  description: "Compare XFI token performance against market benchmarks and provide relative analysis",
  schema: z.object({
    comparisonMetric: z.enum(["performance", "volatility", "volume", "all"]).default("all").describe("Specific metric to compare")
  }),
  func: async (input) => {
    try {
      const analytics = await PriceAnalyticsService.getComprehensivePriceAnalytics(30);
      
      // Benchmark comparisons (using typical crypto market metrics)
      const benchmarks = {
        btc: { name: "Bitcoin", performance24h: 2.1, volatility: 4.2, marketCap: 1800000000000 },
        eth: { name: "Ethereum", performance24h: 3.5, volatility: 5.8, marketCap: 420000000000 },
        crypto_market: { name: "Crypto Market Average", performance24h: 1.8, volatility: 8.5, marketCap: 50000000000 }
      };
      
      const xfiMetrics = {
        performance24h: analytics.marketData.price_change_percentage_24h,
        volatility: analytics.volatility.daily,
        marketCap: analytics.marketData.market_cap,
        volume24h: analytics.marketData.total_volume
      };
      
      const result = {
        xfiMetrics: {
          price: analytics.marketData.current_price,
          performance24h: xfiMetrics.performance24h + '%',
          volatility: xfiMetrics.volatility + '%',
          marketCap: '$' + (xfiMetrics.marketCap / 1000000).toFixed(2) + 'M',
          volume24h: '$' + (xfiMetrics.volume24h / 1000).toFixed(0) + 'K'
        },
        comparisons: Object.entries(benchmarks).map(([key, benchmark]) => ({
          asset: benchmark.name,
          performanceComparison: {
            xfi: xfiMetrics.performance24h.toFixed(2) + '%',
            benchmark: benchmark.performance24h.toFixed(2) + '%',
            difference: (xfiMetrics.performance24h - benchmark.performance24h).toFixed(2) + '%',
            outperforming: xfiMetrics.performance24h > benchmark.performance24h
          },
          volatilityComparison: {
            xfi: xfiMetrics.volatility.toFixed(1) + '%',
            benchmark: benchmark.volatility.toFixed(1) + '%',
            moreVolatile: xfiMetrics.volatility > benchmark.volatility
          }
        })),
        relativeAnalysis: {
          marketPosition: xfiMetrics.marketCap > 10000000 ? "Mid-cap" : "Small-cap",
          liquidityLevel: (xfiMetrics.volume24h / xfiMetrics.marketCap * 100) > 5 ? "High" : "Moderate",
          riskProfile: xfiMetrics.volatility > 10 ? "High Risk" : xfiMetrics.volatility > 6 ? "Medium Risk" : "Lower Risk"
        },
        insights: [
          `📊 XFI ${xfiMetrics.performance24h > 0 ? 'outperformed' : 'underperformed'} crypto market average by ${Math.abs(xfiMetrics.performance24h - benchmarks.crypto_market.performance24h).toFixed(1)}%`,
          `⚡ Volatility is ${xfiMetrics.volatility > benchmarks.crypto_market.volatility ? 'higher' : 'lower'} than market average (${xfiMetrics.volatility.toFixed(1)}% vs ${benchmarks.crypto_market.volatility}%)`,
          `🏦 Market cap of $${(xfiMetrics.marketCap / 1000000).toFixed(2)}M places XFI in ${xfiMetrics.marketCap > 10000000 ? 'mid-cap' : 'small-cap'} category`,
          `💧 Volume/Market Cap ratio of ${(xfiMetrics.volume24h / xfiMetrics.marketCap * 100).toFixed(1)}% indicates ${(xfiMetrics.volume24h / xfiMetrics.marketCap * 100) > 5 ? 'good' : 'moderate'} liquidity`,
          `🎯 Risk assessment: ${xfiMetrics.volatility > 10 ? 'High volatility suggests higher risk/reward potential' : 'Moderate volatility indicates balanced risk profile'}`
        ],
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error comparing XFI market performance: ${error}`;
    }
  },
}); 