/**
 * Aave V3 Benchmark JavaScript Implementation
 * Builds a 1-year trailing, TVL-weighted APY benchmark for Aave-V3 USDC + USDT pools
 */

const POOLS_API = "https://yields.llama.fi/pools";
const CHART_API = "https://yields.llama.fi/chart/";
const ROLL = 365; // rolling-mean window (days)
const HEADERS = { "User-Agent": "llama-aave-benchmark" };

/**
 * Fetch JSON with retry logic for rate limiting
 */
async function fetchJson(url, tries = 3) {
    for (let i = 0; i < tries; i++) {
        try {
            const response = await fetch(url, { headers: HEADERS });
            
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get("Retry-After") || "5");
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (i === tries - 1) throw error;
        }
    }
}

/**
 * Get Aave-V3 pools that hold USDC or USDT
 */
async function getCatalogue() {
    const data = await fetchJson(POOLS_API);
    return data.data.filter(pool => 
        pool.project.toLowerCase().includes("aave-v3") &&
        (pool.symbol.toUpperCase().includes("USDC") || pool.symbol.toUpperCase().includes("USDT"))
    );
}

/**
 * Download and process pool history
 */
async function getPoolHistory(poolId, symbol, chain, days) {
    try {
        const data = await fetchJson(CHART_API + poolId);
        let records = data.data || [];
        
        if (records.length === 0) return [];
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        return records
            .map(record => {
                // Pick first non-null APY value
                const apy = record.apy ?? record.apyBase ?? record.apyBase7d;
                if (!apy || !record.tvlUsd || !record.timestamp) return null;
                
                const date = new Date(record.timestamp * 1000);
                if (date < cutoffDate) return null;
                
                return {
                    date: date.toISOString().split('T')[0],
                    apy: parseFloat(apy),
                    tvlUsd: parseFloat(record.tvlUsd),
                    poolId,
                    token: symbol,
                    chain
                };
            })
            .filter(record => record !== null);
    } catch (error) {
        console.warn(`Failed to fetch pool ${poolId}:`, error.message);
        return [];
    }
}

/**
 * Calculate rolling mean
 */
function calculateRollingMean(values, window) {
    const result = [];
    for (let i = 0; i < values.length; i++) {
        if (i < window - 1) {
            result.push(null);
        } else {
            const slice = values.slice(i - window + 1, i + 1);
            const sum = slice.reduce((a, b) => a + b, 0);
            result.push(sum / slice.length);
        }
    }
    return result;
}

/**
 * Calculate TVL-weighted benchmark
 */
function calculateBenchmark(rawData) {
    // Group by date and calculate daily TVL-weighted APY
    const dailyData = {};
    
    rawData.forEach(record => {
        if (!dailyData[record.date]) {
            dailyData[record.date] = { totalTvl: 0, weightedApy: 0 };
        }
        dailyData[record.date].totalTvl += record.tvlUsd;
        dailyData[record.date].weightedApy += record.apy * record.tvlUsd;
    });
    
    // Calculate final weighted APY for each date
    const dailyBenchmark = Object.entries(dailyData)
        .map(([date, data]) => ({
            date,
            Stable_bmk: data.weightedApy / data.totalTvl
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate 1-year rolling mean
    const apyValues = dailyBenchmark.map(d => d.Stable_bmk);
    const rollingMeans = calculateRollingMean(apyValues, ROLL);
    
    return dailyBenchmark.map((item, index) => ({
        ...item,
        Stable_bmk_1yr: rollingMeans[index]
    }));
}

/**
 * Main function to get Aave V3 benchmark data
 * @param {number} days - Number of days to include in final output (default: 365)
 * @returns {Object} Contains rawData array and benchmark array
 */
async function getAaveV3Benchmark(days = 365) {
    try {
        console.log("Fetching Aave V3 pool catalogue...");
        const pools = await getCatalogue();
        
        if (pools.length === 0) {
            throw new Error("No Aave V3 USDC/USDT pools found");
        }
        
        console.log(`Found ${pools.length} pools. Downloading historical data...`);
        
        // Download data for plotting days + rolling window
        const rawDays = days + ROLL;
        const promises = pools.map(pool => {
            const symbol = pool.symbol.toUpperCase().includes("USDC") ? "USDC" : "USDT";
            return getPoolHistory(pool.pool, symbol, pool.chain, rawDays);
        });
        
        const results = await Promise.all(promises);
        const rawData = results.flat().filter(record => record);
        
        if (rawData.length === 0) {
            throw new Error("No historical data downloaded");
        }
        
        console.log(`Downloaded ${rawData.length} data points`);
        
        // Calculate benchmark
        const benchmark = calculateBenchmark(rawData);
        
        // Filter to requested days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days + 1);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        
        const filteredBenchmark = benchmark.filter(item => item.date >= cutoffStr);
        const filteredRawData = rawData.filter(item => item.date >= cutoffStr);
        
        console.log(`Benchmark calculated with ${filteredBenchmark.length} daily points`);
        
        return {
            rawData: filteredRawData,
            benchmark: filteredBenchmark,
            summary: {
                totalPools: pools.length,
                dataPoints: filteredRawData.length,
                benchmarkDays: filteredBenchmark.length,
                latestBenchmark: filteredBenchmark[filteredBenchmark.length - 1]?.Stable_bmk,
                latest1YrBenchmark: filteredBenchmark[filteredBenchmark.length - 1]?.Stable_bmk_1yr
            }
        };
        
    } catch (error) {
        console.error("Error in getAaveV3Benchmark:", error);
        throw error;
    }
}

// Export for use
// if (typeof module !== 'undefined' && module.exports) {
//     module.exports = { getAaveV3Benchmark };
// }

// Example usage:
getAaveV3Benchmark(365).then(result => {
    console.log("Latest benchmark APY:", result.summary.latestBenchmark);
    console.log("Latest 1-year trailing APY:", result.summary.latest1YrBenchmark);
    console.log("Total data points:", result.summary.dataPoints);
});