// Parallel Loading Test Script
// Tests different concurrency levels to find optimal balance between speed and rate limit compliance

const fetch = globalThis.fetch;

// Test configuration
const TEST_ITEM_IDS = [
  20801, 20802, 20803, 20804, 20805, 20806, 20807, 20808, 20809, 20810,
  20811, 20812, 20813, 20814, 20815, 20816, 20817, 20818, 20819, 20820,
  20821, 20822, 20823, 20824, 20825, 20826, 20827, 20828, 20829, 20830
];

const CONCURRENCY_CONFIGS = [
  { name: 'Sequential (1)', concurrency: 1 },
  { name: 'Low (3)', concurrency: 3 },
  { name: 'Medium (5)', concurrency: 5 },
  { name: 'High (10)', concurrency: 10 },
  { name: 'Very High (15)', concurrency: 15 },
  { name: 'Maximum (20)', concurrency: 20 },
];

async function fetchItemIcon(itemId, abortSignal = null) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        controller.abort();
        clearTimeout(timeoutId);
      });
    }
    
    const response = await fetch(`https://xivapi.com/Item/${itemId}?columns=Icon`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 429) {
        return { error: 'RATE_LIMIT', status: 429 };
      }
      return { error: 'HTTP_ERROR', status: response.status };
    }
    
    const data = await response.json();
    return { success: true, icon: data?.Icon };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { error: 'TIMEOUT' };
    }
    return { error: 'NETWORK_ERROR', message: error.message };
  }
}

/**
 * Process items in parallel with controlled concurrency
 */
async function processInParallel(itemIds, concurrency, delayBetweenBatches = 0) {
  const results = {
    total: itemIds.length,
    success: 0,
    rateLimit: 0,
    errors: 0,
    timings: []
  };
  
  const startTime = Date.now();
  const requestTimestamps = [];
  
  // Process items in batches
  for (let i = 0; i < itemIds.length; i += concurrency) {
    const batch = itemIds.slice(i, i + concurrency);
    const batchStartTime = Date.now();
    
    // Wait if we need to respect rate limits
    if (delayBetweenBatches > 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
    
    // Process batch in parallel
    const batchPromises = batch.map(async (itemId) => {
      const requestStart = Date.now();
      
      // Check rate limit before making request
      const now = Date.now();
      const oneSecondAgo = now - 1000;
      const recentRequests = requestTimestamps.filter(ts => ts > oneSecondAgo);
      
      // If we have too many requests in the last second, wait
      if (recentRequests.length >= 20) {
        const oldestRequest = requestTimestamps[0];
        const waitTime = (oldestRequest + 1000) - now;
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime + 10));
        }
      }
      
      // Record request timestamp
      requestTimestamps.push(Date.now());
      // Keep only last 20 timestamps
      if (requestTimestamps.length > 20) {
        requestTimestamps.shift();
      }
      
      const result = await fetchItemIcon(itemId);
      const requestTime = Date.now() - requestStart;
      
      results.timings.push(requestTime);
      
      if (result.success) {
        results.success++;
        process.stdout.write(`✓`);
      } else if (result.error === 'RATE_LIMIT') {
        results.rateLimit++;
        process.stdout.write(`⚠`);
      } else {
        results.errors++;
        process.stdout.write(`✗`);
      }
      
      return result;
    });
    
    await Promise.all(batchPromises);
    const batchTime = Date.now() - batchStartTime;
  }
  
  const totalTime = Date.now() - startTime;
  const avgTime = results.timings.reduce((a, b) => a + b, 0) / results.timings.length;
  const minTime = Math.min(...results.timings);
  const maxTime = Math.max(...results.timings);
  
  return {
    ...results,
    totalTime,
    avgTime,
    minTime,
    maxTime
  };
}

async function testConcurrency(config, itemIds) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${config.name}`);
  console.log(`Concurrency: ${config.concurrency} parallel requests`);
  console.log(`${'='.repeat(60)}`);
  
  // Calculate delay between batches to respect rate limits
  // If concurrency is 20, we can do 20 requests immediately, then wait 1 second
  // If concurrency is 10, we can do 10 requests, wait 0.5s, then 10 more
  const delayBetweenBatches = config.concurrency >= 20 ? 1000 : (1000 / (20 / config.concurrency));
  
  const results = await processInParallel(itemIds, config.concurrency, delayBetweenBatches);
  
  console.log(`\n\nResults:`);
  console.log(`  Total requests: ${results.total}`);
  console.log(`  Successful: ${results.success} (${(results.success/results.total*100).toFixed(1)}%)`);
  console.log(`  Rate limited: ${results.rateLimit} (${(results.rateLimit/results.total*100).toFixed(1)}%)`);
  console.log(`  Errors: ${results.errors} (${(results.errors/results.total*100).toFixed(1)}%)`);
  console.log(`  Total time: ${results.totalTime}ms (${(results.totalTime/1000).toFixed(2)}s)`);
  console.log(`  Average request time: ${results.avgTime.toFixed(0)}ms`);
  console.log(`  Min request time: ${results.minTime}ms`);
  console.log(`  Max request time: ${results.maxTime}ms`);
  console.log(`  Effective rate: ${(results.total / (results.totalTime/1000)).toFixed(1)} req/sec`);
  console.log(`  Time per item: ${(results.totalTime / results.total).toFixed(0)}ms`);
  
  // Wait a bit before next test to avoid interference
  console.log(`\nWaiting 3 seconds before next test...`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return results;
}

async function runTests() {
  console.log('XIVAPI Parallel Loading Test');
  console.log(`Testing ${TEST_ITEM_IDS.length} items with different concurrency levels\n`);
  
  const allResults = [];
  
  for (const config of CONCURRENCY_CONFIGS) {
    const result = await testConcurrency(config, TEST_ITEM_IDS);
    allResults.push({ config, result });
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  allResults.forEach(({ config, result }) => {
    console.log(`${config.name}:`);
    console.log(`  Success rate: ${(result.success/result.total*100).toFixed(1)}%`);
    console.log(`  Rate limit hits: ${result.rateLimit}`);
    console.log(`  Total time: ${(result.totalTime/1000).toFixed(2)}s`);
    console.log(`  Time per item: ${(result.totalTime / result.total).toFixed(0)}ms`);
    console.log('');
  });
  
  // Find best configuration (100% success, no rate limits, fastest)
  const bestConfig = allResults
    .filter(({ result }) => result.rateLimit === 0 && result.success === result.total)
    .sort((a, b) => a.result.totalTime - b.result.totalTime)[0];
  
  if (bestConfig) {
    console.log(`\n✅ Recommended configuration: ${bestConfig.config.name}`);
    console.log(`   Concurrency: ${bestConfig.config.concurrency} parallel requests`);
    console.log(`   Expected time for 30 items: ${(bestConfig.result.totalTime/1000).toFixed(2)}s`);
    console.log(`   Time per item: ${(bestConfig.result.totalTime / bestConfig.result.total).toFixed(0)}ms`);
    console.log(`   Speedup vs sequential: ${((allResults[0].result.totalTime / bestConfig.result.totalTime)).toFixed(1)}x faster`);
  } else {
    console.log(`\n⚠️  No configuration achieved 100% success without rate limits`);
    console.log(`   Consider using the safest configuration that works`);
    
    // Find fastest with acceptable rate limit hits (< 10%)
    const acceptableConfig = allResults
      .filter(({ result }) => (result.rateLimit / result.total) < 0.1 && result.success === result.total)
      .sort((a, b) => a.result.totalTime - b.result.totalTime)[0];
    
    if (acceptableConfig) {
      console.log(`\n💡 Alternative: ${acceptableConfig.config.name}`);
      console.log(`   Concurrency: ${acceptableConfig.config.concurrency}`);
      console.log(`   Rate limit hits: ${acceptableConfig.result.rateLimit} (${(acceptableConfig.result.rateLimit/acceptableConfig.result.total*100).toFixed(1)}%)`);
      console.log(`   Expected time for 30 items: ${(acceptableConfig.result.totalTime/1000).toFixed(2)}s`);
    }
  }
}

// Run tests
runTests().catch(console.error);
