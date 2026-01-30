// API Rate Testing Script
// Tests different request rates to find optimal balance between speed and rate limit compliance
// Run with: node test_api_rate.js

// Use global fetch (Node 18+ has built-in fetch)
const fetch = globalThis.fetch;

// Test configuration
const TEST_ITEM_IDS = [
  20801, 20802, 20803, 20804, 20805, 20806, 20807, 20808, 20809, 20810,
  20811, 20812, 20813, 20814, 20815, 20816, 20817, 20818, 20819, 20820,
  20821, 20822, 20823, 20824, 20825, 20826, 20827, 20828, 20829, 20830
];

const RATE_CONFIGS = [
  { name: 'Conservative (15 req/sec)', reqPerSec: 15, delayMs: 67 },  // 1000/15 ≈ 66.7ms
  { name: 'Safe (17 req/sec)', reqPerSec: 17, delayMs: 59 },        // 1000/17 ≈ 58.8ms
  { name: 'Current (19 req/sec)', reqPerSec: 19, delayMs: 53 },     // 1000/19 ≈ 52.6ms
  { name: 'Aggressive (20 req/sec)', reqPerSec: 20, delayMs: 50 },  // 1000/20 = 50ms
  { name: 'Very Aggressive (22 req/sec)', reqPerSec: 22, delayMs: 45 }, // Testing beyond limit
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

async function testRate(config, itemIds) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${config.name}`);
  console.log(`Rate: ${config.reqPerSec} req/sec, Delay: ${config.delayMs}ms`);
  console.log(`${'='.repeat(60)}`);
  
  const results = {
    total: itemIds.length,
    success: 0,
    rateLimit: 0,
    errors: 0,
    timings: []
  };
  
  const startTime = Date.now();
  
  for (let i = 0; i < itemIds.length; i++) {
    const itemId = itemIds[i];
    const requestStart = Date.now();
    
    // Wait for delay (except first request)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, config.delayMs));
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
  }
  
  const totalTime = Date.now() - startTime;
  const avgTime = results.timings.reduce((a, b) => a + b, 0) / results.timings.length;
  const minTime = Math.min(...results.timings);
  const maxTime = Math.max(...results.timings);
  
  console.log(`\n\nResults:`);
  console.log(`  Total requests: ${results.total}`);
  console.log(`  Successful: ${results.success} (${(results.success/results.total*100).toFixed(1)}%)`);
  console.log(`  Rate limited: ${results.rateLimit} (${(results.rateLimit/results.total*100).toFixed(1)}%)`);
  console.log(`  Errors: ${results.errors} (${(results.errors/results.total*100).toFixed(1)}%)`);
  console.log(`  Total time: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
  console.log(`  Average request time: ${avgTime.toFixed(0)}ms`);
  console.log(`  Min request time: ${minTime}ms`);
  console.log(`  Max request time: ${maxTime}ms`);
  console.log(`  Effective rate: ${(results.total / (totalTime/1000)).toFixed(1)} req/sec`);
  
  // Wait a bit before next test to avoid interference
  console.log(`\nWaiting 3 seconds before next test...`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return results;
}

async function runTests() {
  console.log('XIVAPI Rate Limit Testing');
  console.log(`Testing ${TEST_ITEM_IDS.length} items with different rate configurations\n`);
  
  const allResults = [];
  
  for (const config of RATE_CONFIGS) {
    const result = await testRate(config, TEST_ITEM_IDS);
    allResults.push({ config, result });
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  allResults.forEach(({ config, result }) => {
    console.log(`${config.name}:`);
    console.log(`  Success rate: ${(result.success/result.total*100).toFixed(1)}%`);
    console.log(`  Rate limit hits: ${result.rateLimit}`);
    console.log(`  Total time: ${(result.timings.reduce((a, b) => a + b, 0) / 1000).toFixed(2)}s`);
    console.log('');
  });
  
  // Find best configuration
  const bestConfig = allResults
    .filter(({ result }) => result.rateLimit === 0 && result.success === result.total)
    .sort((a, b) => {
      const aTime = a.result.timings.reduce((sum, t) => sum + t, 0);
      const bTime = b.result.timings.reduce((sum, t) => sum + t, 0);
      return aTime - bTime;
    })[0];
  
  if (bestConfig) {
    console.log(`\n✅ Recommended configuration: ${bestConfig.config.name}`);
    console.log(`   Delay: ${bestConfig.config.delayMs}ms between requests`);
    console.log(`   Expected time for 30 items: ${(30 * bestConfig.config.delayMs / 1000).toFixed(2)}s`);
  } else {
    console.log(`\n⚠️  No configuration achieved 100% success without rate limits`);
    console.log(`   Consider using the safest configuration that works`);
  }
}

// Run tests
runTests().catch(console.error);
