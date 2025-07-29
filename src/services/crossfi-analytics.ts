import { config } from 'dotenv';
import { publicClient } from '../config/viem.js';
import { formatEther } from 'viem';

// Load environment variables
config();

export interface NetworkStats {
  chainId: number;
  blockHeight: number;
  networkHealth: string;
  avgBlockTime: number;
  transactionCount: number;
  timestamp: number;
  // Enhanced with API data
  totalAddresses: number;
  totalTransactions: number;
  activeValidators: number;
  inactiveValidators: number;
}

export interface TokenHolders {
  xfi: number;
  mpx: number;
  totalAddresses: number;
  adoptionRate: number;
}

export interface ValidatorMetrics {
  active: number;
  inactive: number;
  maxValidators: number;
  decentralizationRatio: number;
  minCommissionRate: string;
  unbondingTime: string;
}

export interface StakingMetrics {
  totalStaked: string;
  totalStakedFormatted: string;
  stakingRatio: number;
  unbondingTime: string;
  minCommissionRate: string;
}

export interface MarketData {
  symbol: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  change24h?: number;
  lastUpdated: number;
}

export interface CrossFiApiResponse {
  total_holders: {
    xfi: number;
    mpx: number;
  };
  validators: {
    active: number;
    inactive: number;
  };
  total_addresses: string;
  staking_params: {
    unbonding_time: string;
    max_validators: number;
    max_entries: number;
    historical_entries: number;
    bond_denom: string;
    min_commission_rate: string;
  };
  latest_block_hash: string;
  latest_block_height: string;
  latest_block_time: string;
  total_txs: string;
  coins: Array<{
    denom: string;
    amount: string;
  }>;
  staked_coins: Array<{
    denom: string;
    amount: string;
  }>;
}

export interface TransactionAnalytics {
  totalTransactions: number;
  avgGasPrice: string;
  avgTransactionValue: string;
  uniqueAddresses: number;
}

export class CrossFiAnalyticsService {
  
  /**
   * Get comprehensive network statistics using CrossFi API
   */
  static async getNetworkStats(): Promise<NetworkStats> {
    try {
      // Get data from CrossFi API
      const isProduction = process.env.ENVIRONMENT === 'production';
      const apiUrl = isProduction 
        ? 'https://xfiscan.com/api/1.0/stat'
        : 'https://test.xfiscan.com/api/1.0/stat';
      const response = await fetch(apiUrl);
      const apiData: CrossFiApiResponse = await response.json();
      
      // Get additional data from our blockchain client
      const blockNumber = await publicClient.getBlockNumber();
      const latestBlock = await publicClient.getBlock({ blockNumber });
      
      // Calculate network health based on validator distribution
      const totalValidators = apiData.validators.active + apiData.validators.inactive;
      const activeRatio = apiData.validators.active / totalValidators;
      const networkHealth = activeRatio > 0.8 ? 'Excellent' : 
                           activeRatio > 0.6 ? 'Good' : 
                           activeRatio > 0.4 ? 'Fair' : 'Needs Attention';
      
      return {
        chainId: 4157,
        blockHeight: Number(apiData.latest_block_height),
        networkHealth,
        avgBlockTime: 5, // CrossFi typically has ~5s block times
        transactionCount: latestBlock.transactions.length,
        timestamp: new Date(apiData.latest_block_time).getTime(),
        totalAddresses: parseInt(apiData.total_addresses),
        totalTransactions: Number(apiData.total_txs),
        activeValidators: apiData.validators.active,
        inactiveValidators: apiData.validators.inactive
      };
    } catch (error) {
      console.error('Error getting network stats:', error);
      throw new Error('Failed to get network statistics');
    }
  }

  /**
   * Get token holder analytics
   */
  static async getTokenHolderMetrics(): Promise<TokenHolders> {
    try {
      const isProduction = process.env.ENVIRONMENT === 'production';
      const apiUrl = isProduction 
        ? 'https://xfiscan.com/api/1.0/stat'
        : 'https://test.xfiscan.com/api/1.0/stat';
      const response = await fetch(apiUrl);
      const apiData: CrossFiApiResponse = await response.json();
      
      const totalAddresses = parseInt(apiData.total_addresses);
      const xfiHolders = apiData.total_holders.xfi;
      const mpxHolders = apiData.total_holders.mpx;
      
      // Calculate adoption rate (percentage of addresses holding tokens)
      const adoptionRate = ((xfiHolders + mpxHolders) / totalAddresses) * 100;
      
      return {
        xfi: xfiHolders,
        mpx: mpxHolders,
        totalAddresses,
        adoptionRate
      };
    } catch (error) {
      console.error('Error getting token holder metrics:', error);
      throw new Error('Failed to get token holder metrics');
    }
  }

  /**
   * Get validator metrics
   */
  static async getValidatorMetrics(): Promise<ValidatorMetrics> {
    try {
      const isProduction = process.env.ENVIRONMENT === 'production';
      const apiUrl = isProduction 
        ? 'https://xfiscan.com/api/1.0/stat'
        : 'https://test.xfiscan.com/api/1.0/stat';
      const response = await fetch(apiUrl);
      const apiData: CrossFiApiResponse = await response.json();
      
      const totalValidators = apiData.validators.active + apiData.validators.inactive;
      const decentralizationRatio = (apiData.validators.inactive / totalValidators) * 100;
      
      return {
        active: apiData.validators.active,
        inactive: apiData.validators.inactive,
        maxValidators: apiData.staking_params.max_validators,
        decentralizationRatio,
        minCommissionRate: apiData.staking_params.min_commission_rate,
        unbondingTime: apiData.staking_params.unbonding_time
      };
    } catch (error) {
      console.error('Error getting validator metrics:', error);
      throw new Error('Failed to get validator metrics');
    }
  }

  /**
   * Get staking metrics
   */
  static async getStakingMetrics(): Promise<StakingMetrics> {
    try {
      const isProduction = process.env.ENVIRONMENT === 'production';
      const apiUrl = isProduction 
        ? 'https://xfiscan.com/api/1.0/stat'
        : 'https://test.xfiscan.com/api/1.0/stat';
      const response = await fetch(apiUrl);
      const apiData: CrossFiApiResponse = await response.json();
      
      // Find MPX staked amount
      const mpxStaked = apiData.staked_coins.find(coin => coin.denom === 'mpx');
      const totalStaked = mpxStaked ? mpxStaked.amount : '0';
      
      // Find total MPX supply
      const mpxTotal = apiData.coins.find(coin => coin.denom === 'mpx');
      const totalSupply = mpxTotal ? mpxTotal.amount : '0';
      
      // Calculate staking ratio
      const stakingRatio = totalSupply !== '0' ? 
        (parseFloat(totalStaked) / parseFloat(totalSupply)) * 100 : 0;
      
      // Format for display (convert from wei-like units)
      const totalStakedFormatted = (parseFloat(totalStaked) / Math.pow(10, 18)).toLocaleString();
      
      return {
        totalStaked,
        totalStakedFormatted,
        stakingRatio,
        unbondingTime: apiData.staking_params.unbonding_time,
        minCommissionRate: apiData.staking_params.min_commission_rate
      };
    } catch (error) {
      console.error('Error getting staking metrics:', error);
      throw new Error('Failed to get staking metrics');
    }
  }

  /**
   * Get basic market data for XFI token
   */
  static async getMarketData(): Promise<MarketData> {
    try {
      // Placeholder for actual market data API integration
      // You would integrate with CoinGecko, CoinMarketCap, or CrossFi's own API
      
      return {
        symbol: 'XFI',
        price: undefined, // To be fetched from real API
        marketCap: undefined,
        volume24h: undefined,
        change24h: undefined,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('Error getting market data:', error);
      throw new Error('Failed to get market data');
    }
  }

  /**
   * Analyze recent transactions on the network
   */
  static async getTransactionAnalytics(blockCount: number = 10): Promise<TransactionAnalytics> {
    try {
      // Get basic stats from API
      const isProduction = process.env.ENVIRONMENT === 'production';
      const apiUrl = isProduction 
        ? 'https://xfiscan.com/api/1.0/stat'
        : 'https://test.xfiscan.com/api/1.0/stat';
      const response = await fetch(apiUrl);
      const apiData: CrossFiApiResponse = await response.json();
      
      // Get detailed transaction data from blockchain
      const latestBlockNumber = await publicClient.getBlockNumber();
      let totalTransactions = 0;
      let totalValue = 0n;
      const uniqueAddresses = new Set<string>();
      
      // Analyze recent blocks
      for (let i = 0; i < blockCount; i++) {
        const block = await publicClient.getBlock({
          blockNumber: latestBlockNumber - BigInt(i),
          includeTransactions: true
        });
        
        if (block.transactions) {
          totalTransactions += block.transactions.length;
          
          for (const tx of block.transactions) {
            if (typeof tx === 'object') {
              uniqueAddresses.add(tx.from);
              if (tx.to) uniqueAddresses.add(tx.to);
              totalValue += tx.value;
            }
          }
        }
      }
      
      // Get current gas price for average
      const gasPrice = await publicClient.getGasPrice();
      
      return {
        totalTransactions: parseInt(apiData.total_txs),
        avgGasPrice: formatEther(gasPrice),
        avgTransactionValue: formatEther(totalTransactions > 0 ? totalValue / BigInt(totalTransactions) : 0n),
        uniqueAddresses: parseInt(apiData.total_addresses)
      };
    } catch (error) {
      console.error('Error getting transaction analytics:', error);
      throw new Error('Failed to get transaction analytics');
    }
  }

  /**
   * Get ecosystem insights summary with real API data
   */
  static async getEcosystemInsights(): Promise<{
    networkStats: NetworkStats;
    tokenHolders: TokenHolders;
    validators: ValidatorMetrics;
    staking: StakingMetrics;
    marketData: MarketData;
    transactionAnalytics: TransactionAnalytics;
    summary: string;
  }> {
    try {
      const [networkStats, tokenHolders, validators, staking, marketData, transactionAnalytics] = await Promise.all([
        this.getNetworkStats(),
        this.getTokenHolderMetrics(),
        this.getValidatorMetrics(),
        this.getStakingMetrics(),
        this.getMarketData(),
        this.getTransactionAnalytics()
      ]);

      // Generate comprehensive insights summary
      const summary = this.generateComprehensiveInsightsSummary(
        networkStats, tokenHolders, validators, staking, transactionAnalytics
      );

      return {
        networkStats,
        tokenHolders,
        validators,
        staking,
        marketData,
        transactionAnalytics,
        summary
      };
    } catch (error) {
      console.error('Error getting ecosystem insights:', error);
      throw new Error('Failed to get ecosystem insights');
    }
  }

  /**
   * Generate comprehensive AI-friendly insights summary
   */
  private static generateComprehensiveInsightsSummary(
    networkStats: NetworkStats,
    tokenHolders: TokenHolders,
    validators: ValidatorMetrics,
    staking: StakingMetrics,
    transactionAnalytics: TransactionAnalytics
  ): string {
    const insights = [];
    
    // Network Health Assessment
    insights.push(`🌐 CrossFi Network: ${networkStats.networkHealth} health at block #${networkStats.blockHeight.toLocaleString()}`);
    insights.push(`📊 Network Scale: ${networkStats.totalAddresses.toLocaleString()} addresses, ${networkStats.totalTransactions.toLocaleString()} total transactions`);
    
    // Token Adoption Insights
    insights.push(`👥 Token Adoption: ${tokenHolders.xfi.toLocaleString()} XFI holders, ${tokenHolders.mpx.toLocaleString()} MPX holders`);
    insights.push(`📈 Adoption Rate: ${tokenHolders.adoptionRate.toFixed(1)}% of addresses hold tokens`);
    
    // Validator Ecosystem
    insights.push(`🏛️ Validators: ${validators.active} active, ${validators.inactive} inactive (${validators.decentralizationRatio.toFixed(1)}% decentralization potential)`);
    
    // Staking Economy
    insights.push(`💰 Staking: ${staking.totalStakedFormatted} MPX staked (${staking.stakingRatio.toFixed(2)}% of supply)`);
    insights.push(`⏱️ Staking Terms: ${staking.unbondingTime} unbonding, ${(parseFloat(staking.minCommissionRate) * 100).toFixed(1)}% min commission`);
    
    return insights.join('\n');
  }

  /**
   * Get DeFi metrics (enhanced framework)
   */
  static async getDeFiMetrics(): Promise<{
    totalValueLocked: string;
    activeProtocols: number;
    topProtocols: Array<{ name: string; tvl: string; apy?: number }>;
    stakingTvl: string;
  }> {
    try {
      const stakingMetrics = await this.getStakingMetrics();
      
      return {
        totalValueLocked: stakingMetrics.totalStakedFormatted,
        activeProtocols: 1, // At least staking is active
        topProtocols: [
          {
            name: "CrossFi Staking",
            tvl: stakingMetrics.totalStakedFormatted,
            apy: undefined // Calculate based on rewards
          }
        ],
        stakingTvl: stakingMetrics.totalStakedFormatted
      };
    } catch (error) {
      console.error('Error getting DeFi metrics:', error);
      throw new Error('Failed to get DeFi metrics');
    }
  }

  /**
   * Get governance and community metrics
   */
  static async getGovernanceMetrics(): Promise<{
    activeProposals: number;
    totalVoters: number;
    communityEngagement: string;
    validatorParticipation: number;
  }> {
    try {
      const validators = await this.getValidatorMetrics();
      const tokenHolders = await this.getTokenHolderMetrics();
      
      return {
        activeProposals: 0, // To be integrated with governance API
        totalVoters: 0,
        communityEngagement: `${tokenHolders.adoptionRate.toFixed(1)}% token adoption rate`,
        validatorParticipation: (validators.active / validators.maxValidators) * 100
      };
    } catch (error) {
      console.error('Error getting governance metrics:', error);
      throw new Error('Failed to get governance metrics');
    }
  }
} 