import { config } from 'dotenv';
import { publicClient } from '../config/viem.js';
import { formatEther } from 'viem';
config();
export class CrossFiAnalyticsService {
    static async getNetworkStats() {
        try {
            const isProduction = process.env.ENVIRONMENT === 'production';
            const apiUrl = isProduction
                ? 'https://xfiscan.com/api/1.0/stat'
                : 'https://test.xfiscan.com/api/1.0/stat';
            const response = await fetch(apiUrl);
            const apiData = await response.json();
            const blockNumber = await publicClient.getBlockNumber();
            const latestBlock = await publicClient.getBlock({ blockNumber });
            const totalValidators = apiData.validators.active + apiData.validators.inactive;
            const activeRatio = apiData.validators.active / totalValidators;
            const networkHealth = activeRatio > 0.8 ? 'Excellent' :
                activeRatio > 0.6 ? 'Good' :
                    activeRatio > 0.4 ? 'Fair' : 'Needs Attention';
            return {
                chainId: 4157,
                blockHeight: Number(apiData.latest_block_height),
                networkHealth,
                avgBlockTime: 5,
                transactionCount: latestBlock.transactions.length,
                timestamp: new Date(apiData.latest_block_time).getTime(),
                totalAddresses: parseInt(apiData.total_addresses),
                totalTransactions: Number(apiData.total_txs),
                activeValidators: apiData.validators.active,
                inactiveValidators: apiData.validators.inactive
            };
        }
        catch (error) {
            console.error('Error getting network stats:', error);
            throw new Error('Failed to get network statistics');
        }
    }
    static async getTokenHolderMetrics() {
        try {
            const isProduction = process.env.ENVIRONMENT === 'production';
            const apiUrl = isProduction
                ? 'https://xfiscan.com/api/1.0/stat'
                : 'https://test.xfiscan.com/api/1.0/stat';
            const response = await fetch(apiUrl);
            const apiData = await response.json();
            const totalAddresses = parseInt(apiData.total_addresses);
            const xfiHolders = apiData.total_holders.xfi;
            const mpxHolders = apiData.total_holders.mpx;
            const adoptionRate = ((xfiHolders + mpxHolders) / totalAddresses) * 100;
            return {
                xfi: xfiHolders,
                mpx: mpxHolders,
                totalAddresses,
                adoptionRate
            };
        }
        catch (error) {
            console.error('Error getting token holder metrics:', error);
            throw new Error('Failed to get token holder metrics');
        }
    }
    static async getValidatorMetrics() {
        try {
            const isProduction = process.env.ENVIRONMENT === 'production';
            const apiUrl = isProduction
                ? 'https://xfiscan.com/api/1.0/stat'
                : 'https://test.xfiscan.com/api/1.0/stat';
            const response = await fetch(apiUrl);
            const apiData = await response.json();
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
        }
        catch (error) {
            console.error('Error getting validator metrics:', error);
            throw new Error('Failed to get validator metrics');
        }
    }
    static async getStakingMetrics() {
        try {
            const isProduction = process.env.ENVIRONMENT === 'production';
            const apiUrl = isProduction
                ? 'https://xfiscan.com/api/1.0/stat'
                : 'https://test.xfiscan.com/api/1.0/stat';
            const response = await fetch(apiUrl);
            const apiData = await response.json();
            const mpxStaked = apiData.staked_coins.find(coin => coin.denom === 'mpx');
            const totalStaked = mpxStaked ? mpxStaked.amount : '0';
            const mpxTotal = apiData.coins.find(coin => coin.denom === 'mpx');
            const totalSupply = mpxTotal ? mpxTotal.amount : '0';
            const stakingRatio = totalSupply !== '0' ?
                (parseFloat(totalStaked) / parseFloat(totalSupply)) * 100 : 0;
            const totalStakedFormatted = (parseFloat(totalStaked) / Math.pow(10, 18)).toLocaleString();
            return {
                totalStaked,
                totalStakedFormatted,
                stakingRatio,
                unbondingTime: apiData.staking_params.unbonding_time,
                minCommissionRate: apiData.staking_params.min_commission_rate
            };
        }
        catch (error) {
            console.error('Error getting staking metrics:', error);
            throw new Error('Failed to get staking metrics');
        }
    }
    static async getMarketData() {
        try {
            return {
                symbol: 'XFI',
                price: undefined,
                marketCap: undefined,
                volume24h: undefined,
                change24h: undefined,
                lastUpdated: Date.now()
            };
        }
        catch (error) {
            console.error('Error getting market data:', error);
            throw new Error('Failed to get market data');
        }
    }
    static async getTransactionAnalytics(blockCount = 10) {
        try {
            const isProduction = process.env.ENVIRONMENT === 'production';
            const apiUrl = isProduction
                ? 'https://xfiscan.com/api/1.0/stat'
                : 'https://test.xfiscan.com/api/1.0/stat';
            const response = await fetch(apiUrl);
            const apiData = await response.json();
            const latestBlockNumber = await publicClient.getBlockNumber();
            let totalTransactions = 0;
            let totalValue = 0n;
            const uniqueAddresses = new Set();
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
                            if (tx.to)
                                uniqueAddresses.add(tx.to);
                            totalValue += tx.value;
                        }
                    }
                }
            }
            const gasPrice = await publicClient.getGasPrice();
            return {
                totalTransactions: parseInt(apiData.total_txs),
                avgGasPrice: formatEther(gasPrice),
                avgTransactionValue: formatEther(totalTransactions > 0 ? totalValue / BigInt(totalTransactions) : 0n),
                uniqueAddresses: parseInt(apiData.total_addresses)
            };
        }
        catch (error) {
            console.error('Error getting transaction analytics:', error);
            throw new Error('Failed to get transaction analytics');
        }
    }
    static async getEcosystemInsights() {
        try {
            const [networkStats, tokenHolders, validators, staking, marketData, transactionAnalytics] = await Promise.all([
                this.getNetworkStats(),
                this.getTokenHolderMetrics(),
                this.getValidatorMetrics(),
                this.getStakingMetrics(),
                this.getMarketData(),
                this.getTransactionAnalytics()
            ]);
            const summary = this.generateComprehensiveInsightsSummary(networkStats, tokenHolders, validators, staking, transactionAnalytics);
            return {
                networkStats,
                tokenHolders,
                validators,
                staking,
                marketData,
                transactionAnalytics,
                summary
            };
        }
        catch (error) {
            console.error('Error getting ecosystem insights:', error);
            throw new Error('Failed to get ecosystem insights');
        }
    }
    static generateComprehensiveInsightsSummary(networkStats, tokenHolders, validators, staking, transactionAnalytics) {
        const insights = [];
        insights.push(`🌐 CrossFi Network: ${networkStats.networkHealth} health at block #${networkStats.blockHeight.toLocaleString()}`);
        insights.push(`📊 Network Scale: ${networkStats.totalAddresses.toLocaleString()} addresses, ${networkStats.totalTransactions.toLocaleString()} total transactions`);
        insights.push(`👥 Token Adoption: ${tokenHolders.xfi.toLocaleString()} XFI holders, ${tokenHolders.mpx.toLocaleString()} MPX holders`);
        insights.push(`📈 Adoption Rate: ${tokenHolders.adoptionRate.toFixed(1)}% of addresses hold tokens`);
        insights.push(`🏛️ Validators: ${validators.active} active, ${validators.inactive} inactive (${validators.decentralizationRatio.toFixed(1)}% decentralization potential)`);
        insights.push(`💰 Staking: ${staking.totalStakedFormatted} MPX staked (${staking.stakingRatio.toFixed(2)}% of supply)`);
        insights.push(`⏱️ Staking Terms: ${staking.unbondingTime} unbonding, ${(parseFloat(staking.minCommissionRate) * 100).toFixed(1)}% min commission`);
        return insights.join('\n');
    }
    static async getDeFiMetrics() {
        try {
            const stakingMetrics = await this.getStakingMetrics();
            return {
                totalValueLocked: stakingMetrics.totalStakedFormatted,
                activeProtocols: 1,
                topProtocols: [
                    {
                        name: "CrossFi Staking",
                        tvl: stakingMetrics.totalStakedFormatted,
                        apy: undefined
                    }
                ],
                stakingTvl: stakingMetrics.totalStakedFormatted
            };
        }
        catch (error) {
            console.error('Error getting DeFi metrics:', error);
            throw new Error('Failed to get DeFi metrics');
        }
    }
    static async getGovernanceMetrics() {
        try {
            const validators = await this.getValidatorMetrics();
            const tokenHolders = await this.getTokenHolderMetrics();
            return {
                activeProposals: 0,
                totalVoters: 0,
                communityEngagement: `${tokenHolders.adoptionRate.toFixed(1)}% token adoption rate`,
                validatorParticipation: (validators.active / validators.maxValidators) * 100
            };
        }
        catch (error) {
            console.error('Error getting governance metrics:', error);
            throw new Error('Failed to get governance metrics');
        }
    }
}
//# sourceMappingURL=crossfi-analytics.js.map