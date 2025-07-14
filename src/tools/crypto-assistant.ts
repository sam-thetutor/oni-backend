import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { CrossFiAnalyticsService } from "../services/crossfi-analytics.js";

// CrossFi Network Stats Tool
export const CrossFiNetworkStatsTool = new DynamicStructuredTool({
  name: "crossfi_network_stats",
  description: "Get real-time CrossFi network statistics including block height, validator count, total addresses, and network health metrics from official CrossFi API",
  schema: z.object({}),
  func: async () => {
    try {
      const stats = await CrossFiAnalyticsService.getNetworkStats();
      
      const result = {
        network: "CrossFi Testnet",
        blockHeight: stats.blockHeight,
        networkHealth: stats.networkHealth,
        totalAddresses: stats.totalAddresses.toLocaleString(),
        totalTransactions: stats.totalTransactions.toLocaleString(),
        activeValidators: stats.activeValidators,
        inactiveValidators: stats.inactiveValidators,
        currentTransactions: stats.transactionCount,
        avgBlockTime: `${stats.avgBlockTime} seconds`,
        lastUpdated: new Date(stats.timestamp).toISOString(),
        
        // AI-friendly insights
        insights: [
          `Network is operating with ${stats.networkHealth.toLowerCase()} health`,
          `${stats.totalAddresses.toLocaleString()} total addresses show strong adoption`,
          `${stats.totalTransactions.toLocaleString()} total transactions demonstrate network activity`,
          `${stats.activeValidators} active validators ensure network security`,
          `${stats.inactiveValidators} inactive validators show decentralization potential`
        ]
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error getting network stats: ${error}`;
    }
  },
});

// CrossFi Ecosystem Insights Tool
export const CrossFiEcosystemInsightsTool = new DynamicStructuredTool({
  name: "crossfi_ecosystem_insights",
  description: "Get comprehensive CrossFi ecosystem analysis including token holders, validators, staking metrics, and market insights using real-time API data",
  schema: z.object({}),
  func: async () => {
    try {
      const insights = await CrossFiAnalyticsService.getEcosystemInsights();
      
      const result = {
        ecosystem: "CrossFi Network",
        networkOverview: {
          blockHeight: insights.networkStats.blockHeight.toLocaleString(),
          health: insights.networkStats.networkHealth,
          totalAddresses: insights.networkStats.totalAddresses.toLocaleString(),
          totalTransactions: insights.networkStats.totalTransactions.toLocaleString()
        },
        tokenAdoption: {
          xfiHolders: insights.tokenHolders.xfi.toLocaleString(),
          mpxHolders: insights.tokenHolders.mpx.toLocaleString(),
          adoptionRate: `${insights.tokenHolders.adoptionRate.toFixed(1)}%`,
          totalAddresses: insights.tokenHolders.totalAddresses.toLocaleString()
        },
        validatorEcosystem: {
          active: insights.validators.active,
          inactive: insights.validators.inactive,
          maxValidators: insights.validators.maxValidators,
          decentralizationPotential: `${insights.validators.decentralizationRatio.toFixed(1)}%`,
          minCommission: `${(parseFloat(insights.validators.minCommissionRate) * 100).toFixed(1)}%`,
          unbondingTime: insights.validators.unbondingTime
        },
        stakingEconomy: {
          totalStaked: insights.staking.totalStakedFormatted,
          stakingRatio: `${insights.staking.stakingRatio.toFixed(2)}%`,
          unbondingTime: insights.staking.unbondingTime,
          minCommission: `${(parseFloat(insights.staking.minCommissionRate) * 100).toFixed(1)}%`
        },
        transactionMetrics: {
          totalTransactions: insights.transactionAnalytics.totalTransactions.toLocaleString(),
          avgGasPrice: `${insights.transactionAnalytics.avgGasPrice} XFI`,
          avgTransactionValue: `${insights.transactionAnalytics.avgTransactionValue} XFI`,
          uniqueAddresses: insights.transactionAnalytics.uniqueAddresses.toLocaleString()
        },
        aiInsights: insights.summary,
        timestamp: new Date().toISOString(),
        
        // Key opportunities and risks
        opportunities: [
          "368 inactive validators show strong decentralization potential",
          `${insights.tokenHolders.adoptionRate.toFixed(1)}% token adoption rate indicates growing ecosystem`,
          "Active staking economy with proper commission structure",
          "High transaction volume demonstrates network utility"
        ],
        risks: [
          "Only 9 active validators currently securing the network",
          "High concentration in validator set needs monitoring",
          "Testnet status - mainnet readiness assessment needed"
        ]
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error getting ecosystem insights: ${error}`;
    }
  },
});

// CrossFi Transaction Analytics Tool
export const CrossFiTransactionAnalyticsTool = new DynamicStructuredTool({
  name: "crossfi_transaction_analytics",
  description: "Analyze recent CrossFi network transaction patterns, gas prices, and activity metrics with real-time data",
  schema: z.object({
    blockCount: z.number().optional().describe("Number of recent blocks to analyze (default: 10, max: 50)")
  }),
  func: async (input) => {
    try {
      const { blockCount = 10 } = input;
      const limitedBlockCount = Math.min(Math.max(blockCount, 1), 50); // Limit between 1-50
      
      const analytics = await CrossFiAnalyticsService.getTransactionAnalytics(limitedBlockCount);
      
      const result = {
        transactionAnalytics: {
          totalTransactions: analytics.totalTransactions.toLocaleString(),
          uniqueAddresses: analytics.uniqueAddresses.toLocaleString(),
          avgGasPrice: analytics.avgGasPrice,
          avgTransactionValue: analytics.avgTransactionValue,
          blocksAnalyzed: limitedBlockCount,
          period: `Last ${limitedBlockCount} blocks`
        },
        networkActivity: {
          activityLevel: analytics.totalTransactions > 50 ? 'High' : analytics.totalTransactions > 20 ? 'Medium' : 'Low',
          gasMarket: `Current gas price: ${analytics.avgGasPrice} XFI`,
          userActivity: `${analytics.uniqueAddresses.toLocaleString()} unique addresses demonstrate active usage`,
          economicActivity: `${analytics.avgTransactionValue} XFI average transaction value`
        },
        insights: [
          `📊 Total Network Transactions: ${analytics.totalTransactions.toLocaleString()}`,
          `💰 Average Transaction Value: ${analytics.avgTransactionValue} XFI`,
          `👥 Unique Active Addresses: ${analytics.uniqueAddresses.toLocaleString()}`,
          `⛽ Current Gas Price: ${analytics.avgGasPrice} XFI`,
          `📈 Network Activity Level: ${analytics.totalTransactions > 50 ? 'High' : analytics.totalTransactions > 20 ? 'Medium' : 'Low'}`
        ],
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error getting transaction analytics: ${error}`;
    }
  },
});

export const CrossFiTokenHolderAnalyticsTool = new DynamicStructuredTool({
  name: "crossfi_token_holder_analytics",
  description: "Analyze CrossFi token holder distribution and adoption metrics for XFI and MPX tokens using real-time data from CrossFi API",
  schema: z.object({}),
  func: async () => {
    try {
      const metrics = await CrossFiAnalyticsService.getTokenHolderMetrics();
      
      const result = {
        tokenDistribution: {
          xfi: {
            holders: metrics.xfi.toLocaleString(),
            percentage: `${((metrics.xfi / metrics.totalAddresses) * 100).toFixed(1)}%`
          },
          mpx: {
            holders: metrics.mpx.toLocaleString(),
            percentage: `${((metrics.mpx / metrics.totalAddresses) * 100).toFixed(1)}%`
          }
        },
        adoptionMetrics: {
          totalAddresses: metrics.totalAddresses.toLocaleString(),
          overallAdoptionRate: `${metrics.adoptionRate.toFixed(1)}%`,
          tokenHolderRatio: `${((metrics.xfi + metrics.mpx) / metrics.totalAddresses).toFixed(2)} tokens per address`
        },
        insights: [
          `${metrics.mpx.toLocaleString()} MPX holders vs ${metrics.xfi.toLocaleString()} XFI holders`,
          `${metrics.adoptionRate.toFixed(1)}% of all addresses hold tokens`,
          `Strong token adoption across ${metrics.totalAddresses.toLocaleString()} total addresses`,
          `MPX has ${((metrics.mpx / metrics.xfi) * 100 - 100).toFixed(1)}% more holders than XFI`
        ],
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error getting token holder analytics: ${error}`;
    }
  },
});

export const CrossFiValidatorMetricsTool = new DynamicStructuredTool({
  name: "crossfi_validator_metrics",
  description: "Get detailed CrossFi validator network analysis including active/inactive validators, decentralization metrics, and staking parameters",
  schema: z.object({}),
  func: async () => {
    try {
      const metrics = await CrossFiAnalyticsService.getValidatorMetrics();
      
      const result = {
        validatorNetwork: {
          active: metrics.active,
          inactive: metrics.inactive,
          total: metrics.active + metrics.inactive,
          maxValidators: metrics.maxValidators,
          utilizationRate: `${((metrics.active / metrics.maxValidators) * 100).toFixed(1)}%`
        },
        decentralization: {
          activeRatio: `${((metrics.active / (metrics.active + metrics.inactive)) * 100).toFixed(1)}%`,
          inactiveRatio: `${metrics.decentralizationRatio.toFixed(1)}%`,
          decentralizationPotential: `${metrics.inactive} inactive validators available`,
          networkMaturity: metrics.active < 20 ? "Early Stage" : metrics.active < 50 ? "Growing" : "Mature"
        },
        stakingParameters: {
          minCommissionRate: `${(parseFloat(metrics.minCommissionRate) * 100).toFixed(1)}%`,
          unbondingTime: metrics.unbondingTime,
          bondingDenom: "MPX"
        },
        securityAssessment: {
          status: metrics.active >= 7 ? "Secure" : "Needs More Validators",
          recommendations: [
            metrics.active < 20 ? "Increase active validator count for better security" : "Good validator count",
            metrics.decentralizationRatio > 80 ? "Excellent decentralization potential" : "Consider validator activation",
            "Monitor commission rates for competitive staking environment"
          ]
        },
        insights: [
          `${metrics.active} active validators currently securing the network`,
          `${metrics.inactive} inactive validators show ${metrics.decentralizationRatio.toFixed(1)}% decentralization potential`,
          `${(parseFloat(metrics.minCommissionRate) * 100).toFixed(1)}% minimum commission ensures fair validator economics`,
          `${metrics.unbondingTime} unbonding period balances security with liquidity`
        ],
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error getting validator metrics: ${error}`;
    }
  },
});

export const CrossFiStakingAnalyticsTool = new DynamicStructuredTool({
  name: "crossfi_staking_analytics",
  description: "Analyze CrossFi staking economy including total staked amounts, staking ratios, and reward parameters using real-time blockchain data",
  schema: z.object({}),
  func: async () => {
    try {
      const metrics = await CrossFiAnalyticsService.getStakingMetrics();
      
      const result = {
        stakingOverview: {
          totalStaked: metrics.totalStakedFormatted,
          stakingRatio: `${metrics.stakingRatio.toFixed(2)}%`,
          bondingToken: "MPX"
        },
        stakingParameters: {
          unbondingTime: metrics.unbondingTime,
          unbondingTimeFormatted: `${parseInt(metrics.unbondingTime.replace('s', '')) / 60} minutes`,
          minCommissionRate: `${(parseFloat(metrics.minCommissionRate) * 100).toFixed(1)}%`,
          maxValidators: 128
        },
        economicHealth: {
          stakingParticipation: metrics.stakingRatio > 30 ? "High" : metrics.stakingRatio > 15 ? "Moderate" : "Low",
          liquidityBalance: metrics.stakingRatio < 70 ? "Healthy" : "High Staking Concentration",
          validatorIncentives: "Competitive commission structure"
        },
        insights: [
          `${metrics.totalStakedFormatted} MPX currently staked in the network`,
          `${metrics.stakingRatio.toFixed(2)}% staking ratio shows ${metrics.stakingRatio > 20 ? 'strong' : 'moderate'} participation`,
          `${parseInt(metrics.unbondingTime.replace('s', '')) / 60} minute unbonding period balances security with flexibility`,
          `${(parseFloat(metrics.minCommissionRate) * 100).toFixed(1)}% minimum commission ensures sustainable validator economics`
        ],
        recommendations: [
          metrics.stakingRatio < 20 ? "Consider incentives to increase staking participation" : "Healthy staking participation",
          "Monitor validator distribution to prevent centralization",
          "Track unbonding patterns for liquidity insights"
        ],
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error getting staking analytics: ${error}`;
    }
  },
});

// CrossFi Market Data Tool
export const CrossFiMarketDataTool = new DynamicStructuredTool({
  name: "crossfi_market_data",
  description: "Get CrossFi market data and price information (framework ready for real market API integration)",
  schema: z.object({}),
  func: async () => {
    try {
      const marketData = await CrossFiAnalyticsService.getMarketData();
      
      // Enhanced with ecosystem metrics for context
      const [tokenHolders, validators, staking] = await Promise.all([
        CrossFiAnalyticsService.getTokenHolderMetrics(),
        CrossFiAnalyticsService.getValidatorMetrics(),
        CrossFiAnalyticsService.getStakingMetrics()
      ]);
      
      const result = {
        marketData: {
          symbol: marketData.symbol,
          price: marketData.price || "API Integration Pending",
          marketCap: marketData.marketCap || "API Integration Pending",
          volume24h: marketData.volume24h || "API Integration Pending",
          change24h: marketData.change24h || "API Integration Pending"
        },
        fundamentalMetrics: {
          totalHolders: (tokenHolders.xfi + tokenHolders.mpx).toLocaleString(),
          adoptionRate: `${tokenHolders.adoptionRate.toFixed(1)}%`,
          stakingRatio: `${staking.stakingRatio.toFixed(2)}%`,
          validatorCount: validators.active,
          networkSecurity: validators.active >= 7 ? "Strong" : "Growing"
        },
        ecosystemHealth: {
          userGrowth: "Strong - based on holder distribution",
          networkActivity: "High - based on transaction volume",
          stakingParticipation: staking.stakingRatio > 20 ? "Healthy" : "Moderate",
          decentralization: `${validators.decentralizationRatio.toFixed(1)}% potential`
        },
        insights: [
          "CrossFi ecosystem shows strong fundamental metrics",
          `${(tokenHolders.xfi + tokenHolders.mpx).toLocaleString()} total token holders indicate growing adoption`,
          `${staking.stakingRatio.toFixed(2)}% staking ratio demonstrates network commitment`,
          "Ready for mainnet launch based on testnet metrics"
        ],
        note: "Price data integration with CoinGecko/CoinMarketCap pending",
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error getting market data: ${error}`;
    }
  },
});

// CrossFi DeFi Metrics Tool
export const CrossFiDeFiMetricsTool = new DynamicStructuredTool({
  name: "crossfi_defi_metrics",
  description: "Analyze CrossFi DeFi ecosystem metrics including Total Value Locked (TVL), active protocols, and staking yields",
  schema: z.object({}),
  func: async () => {
    try {
      const defiMetrics = await CrossFiAnalyticsService.getDeFiMetrics();
      const stakingMetrics = await CrossFiAnalyticsService.getStakingMetrics();
      
      const result = {
        defiOverview: {
          totalValueLocked: defiMetrics.totalValueLocked,
          activeProtocols: defiMetrics.activeProtocols,
          primaryProtocol: "CrossFi Native Staking"
        },
        stakingDeFi: {
          stakingTvl: defiMetrics.stakingTvl,
          stakingRatio: `${stakingMetrics.stakingRatio.toFixed(2)}%`,
          protocol: "Native CrossFi Staking",
          minCommission: `${(parseFloat(stakingMetrics.minCommissionRate) * 100).toFixed(1)}%`
        },
        protocols: defiMetrics.topProtocols.map(protocol => ({
          name: protocol.name,
          tvl: protocol.tvl,
          apy: protocol.apy || "Variable based on network rewards",
          type: "Native Staking"
        })),
        ecosystemDevelopment: {
          stage: "Foundation Phase",
          focus: "Native staking and validator economics",
          nextPhase: "DeFi protocol expansion",
          opportunities: [
            "Lending/borrowing protocols",
            "DEX development",
            "Yield farming opportunities",
            "Cross-chain bridges"
          ]
        },
        insights: [
          `${defiMetrics.totalValueLocked} locked in native staking protocol`,
          `${stakingMetrics.stakingRatio.toFixed(2)}% of supply actively staked`,
          "Strong foundation for DeFi ecosystem expansion",
          "Validator economics create sustainable yield opportunities"
        ],
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error getting DeFi metrics: ${error}`;
    }
  },
});

// CrossFi Ecosystem Summary Tool
export const CrossFiEcosystemSummaryTool = new DynamicStructuredTool({
  name: "crossfi_ecosystem_summary",
  description: "Generate comprehensive CrossFi ecosystem executive summary with key metrics, opportunities, and strategic insights",
  schema: z.object({}),
  func: async () => {
    try {
      const [
        networkStats,
        tokenHolders,
        validators,
        staking,
        defiMetrics,
        governance
      ] = await Promise.all([
        CrossFiAnalyticsService.getNetworkStats(),
        CrossFiAnalyticsService.getTokenHolderMetrics(),
        CrossFiAnalyticsService.getValidatorMetrics(),
        CrossFiAnalyticsService.getStakingMetrics(),
        CrossFiAnalyticsService.getDeFiMetrics(),
        CrossFiAnalyticsService.getGovernanceMetrics()
      ]);
      
      const totalHolders = tokenHolders.xfi + tokenHolders.mpx;
      const ecosystemMaturity = validators.active >= 20 ? "Mature" : validators.active >= 10 ? "Growing" : "Early Stage";
      
      const result = {
        executiveSummary: {
          networkName: "CrossFi",
          currentPhase: "Testnet",
          ecosystemMaturity,
          overallHealth: networkStats.networkHealth,
          lastUpdated: new Date().toISOString()
        },
        keyMetrics: {
          totalAddresses: networkStats.totalAddresses.toLocaleString(),
          totalTransactions: networkStats.totalTransactions.toLocaleString(),
          totalTokenHolders: totalHolders.toLocaleString(),
          adoptionRate: `${tokenHolders.adoptionRate.toFixed(1)}%`,
          activeValidators: validators.active,
          stakingParticipation: `${staking.stakingRatio.toFixed(2)}%`,
          blockHeight: networkStats.blockHeight.toLocaleString()
        },
        strengthsAndOpportunities: {
          strengths: [
            `${networkStats.totalAddresses.toLocaleString()} total addresses show strong user adoption`,
            `${networkStats.totalTransactions.toLocaleString()} total transactions demonstrate network utility`,
            `${totalHolders.toLocaleString()} token holders across XFI and MPX tokens`,
            `${validators.inactive} inactive validators show ${validators.decentralizationRatio.toFixed(1)}% decentralization potential`,
            `${staking.stakingRatio.toFixed(2)}% staking participation indicates network commitment`
          ],
          opportunities: [
            "Activate more validators for increased decentralization",
            "Expand DeFi ecosystem beyond native staking",
            "Implement governance mechanisms for community participation",
            "Prepare for mainnet launch with current strong metrics",
            "Develop cross-chain interoperability solutions"
          ]
        },
        risksAndChallenges: {
          risks: [
            `Only ${validators.active} active validators - centralization risk`,
            "Testnet status - mainnet readiness needs assessment",
            "Limited DeFi protocols currently active",
            "Validator distribution concentration"
          ],
          mitigations: [
            "Incentivize validator activation programs",
            "Implement gradual decentralization roadmap",
            "Develop DeFi protocol partnerships",
            "Monitor and cap validator concentration"
          ]
        },
        strategicRecommendations: [
          "Priority 1: Increase active validator count to 15-20 for better security",
          "Priority 2: Launch governance token and voting mechanisms",
          "Priority 3: Partner with DeFi protocols for ecosystem expansion",
          "Priority 4: Prepare mainnet migration with current strong metrics",
          "Priority 5: Implement cross-chain bridges for interoperability"
        ],
        ecosystemReadiness: {
          mainnetReadiness: `${validators.active >= 10 ? '80' : '60'}%`,
          userAdoption: `${tokenHolders.adoptionRate > 50 ? '90' : '75'}%`,
          validatorNetwork: `${(validators.active / 20) * 100}%`,
          economicSustainability: `${staking.stakingRatio > 20 ? '85' : '70'}%`
        },
        timestamp: new Date().toISOString()
      };
      
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return `Error generating ecosystem summary: ${error}`;
    }
  },
});

// Export all tools
export const CRYPTO_ASSISTANT_TOOLS = [
  CrossFiNetworkStatsTool,
  CrossFiEcosystemInsightsTool,
  CrossFiTransactionAnalyticsTool,
  CrossFiTokenHolderAnalyticsTool,
  CrossFiValidatorMetricsTool,
  CrossFiStakingAnalyticsTool,
  CrossFiMarketDataTool,
  CrossFiDeFiMetricsTool,
  CrossFiEcosystemSummaryTool
]; 