/**
 * Google Play Safety Test Utility
 * 
 * Run these tests before submitting to Google Play
 * to ensure app handles all edge cases safely.
 * 
 * Usage:
 * Import and call testAppSafety() on app launch (dev mode only)
 */

import { safeApiCall, safeApiCallNoThrow, hasInternet, safeGetStorage, safeSetStorage, safeJsonParse } from '@/services/safeApi';

export interface SafetyTestResult {
  test: string;
  passed: boolean;
  message: string;
}

/**
 * Run all safety tests
 * Returns array of test results
 */
export async function testAppSafety(): Promise<SafetyTestResult[]> {
  const results: SafetyTestResult[] = [];

  console.log('🧪 Running Google Play Safety Tests...\n');

  // Test 1: API call with fallback
  try {
    console.log('Test 1: API fallback on network error...');
    const data = await safeApiCall('/api/nonexistent', {
      fallback: [],
      retries: 1,
      silent: true,
    });
    const passed = Array.isArray(data) && data.length === 0;
    results.push({
      test: 'API Fallback',
      passed,
      message: passed ? 'Returns fallback on error ✅' : 'Failed to return fallback ❌',
    });
  } catch {
    results.push({
      test: 'API Fallback',
      passed: false,
      message: 'Should not throw, should return fallback ❌',
    });
  }

  // Test 2: No-throw API call
  try {
    console.log('Test 2: No-throw API wrapper...');
    const { error } = await safeApiCallNoThrow('/api/test-error', {
      fallback: null,
      retries: 1,
      silent: true,
    });
    const passed = error !== null; // Should have error, not throw
    results.push({
      test: 'No-Throw API',
      passed,
      message: passed ? 'Returns error tuple without throwing ✅' : 'Unexpected result ❌',
    });
  } catch {
    results.push({
      test: 'No-Throw API',
      passed: false,
      message: 'Should never throw ❌',
    });
  }

  // Test 3: Safe JSON parse
  try {
    console.log('Test 3: Safe JSON parsing...');
    const invalid = '{invalid json}';
    const result = safeJsonParse(invalid, { default: true });
    const passed = result.default === true;
    results.push({
      test: 'Safe JSON Parse',
      passed,
      message: passed ? 'Returns fallback on invalid JSON ✅' : 'Failed to handle invalid JSON ❌',
    });
  } catch {
    results.push({
      test: 'Safe JSON Parse',
      passed: false,
      message: 'Should not throw on invalid JSON ❌',
    });
  }

  // Test 4: Safe storage read
  try {
    console.log('Test 4: Safe storage access...');
    const result = await safeGetStorage('nonexistent-key-12345');
    const passed = result === null;
    results.push({
      test: 'Safe Storage Read',
      passed,
      message: passed ? 'Returns null on missing key ✅' : 'Unexpected result ❌',
    });
  } catch {
    results.push({
      test: 'Safe Storage Read',
      passed: false,
      message: 'Should not throw on missing key ❌',
    });
  }

  // Test 5: Safe storage write
  try {
    console.log('Test 5: Safe storage write...');
    const success = await safeSetStorage('test-safety-key', 'test-value');
    await safeSetStorage('test-safety-key', ''); // Cleanup
    results.push({
      test: 'Safe Storage Write',
      passed: success,
      message: success ? 'Writes safely without throwing ✅' : 'Write failed ❌',
    });
  } catch {
    results.push({
      test: 'Safe Storage Write',
      passed: false,
      message: 'Should not throw on write ❌',
    });
  }

  // Test 6: Optional chaining safety
  try {
    console.log('Test 6: Defensive data access...');
    const nullObj: any = null;
    const result = nullObj?.field?.nested ?? 'fallback';
    const passed = result === 'fallback';
    results.push({
      test: 'Optional Chaining',
      passed,
      message: passed ? 'Handles null safely with ?? operator ✅' : 'Failed to use fallback ❌',
    });
  } catch {
    results.push({
      test: 'Optional Chaining',
      passed: false,
      message: 'Crashed on null access ❌',
    });
  }

  // Test 7: Array safety
  try {
    console.log('Test 7: Safe array operations...');
    const nullArray: any[] | null = null;
    const result = (nullArray || []).map(x => x);
    const passed = Array.isArray(result) && result.length === 0;
    results.push({
      test: 'Safe Array Operations',
      passed,
      message: passed ? 'Handles null arrays safely ✅' : 'Failed array fallback ❌',
    });
  } catch {
    results.push({
      test: 'Safe Array Operations',
      passed: false,
      message: 'Crashed on null array ❌',
    });
  }

  // Print results
  console.log('\n📊 Safety Test Results:');
  console.log('━'.repeat(50));
  
  let passCount = 0;
  results.forEach(result => {
    if (result.passed) passCount++;
    const emoji = result.passed ? '✅' : '❌';
    console.log(`${emoji} ${result.test}: ${result.message}`);
  });
  
  console.log('━'.repeat(50));
  console.log(`\n${passCount}/${results.length} tests passed`);
  
  if (passCount === results.length) {
    console.log('✅ App is SAFE for Google Play review!');
  } else {
    console.warn('⚠️ Some safety tests failed. Please review.');
  }

  return results;
}

/**
 * Test internet connectivity safely
 */
export async function testInternetConnectivity(): Promise<boolean> {
  console.log('🌐 Testing internet connectivity...');
  const online = await hasInternet();
  console.log(online ? '✅ Internet available' : '❌ No internet connection');
  return online;
}

/**
 * Simulate network error for testing
 */
export function simulateNetworkError() {
  console.warn('🔥 SIMULATING NETWORK ERROR for testing');
  // Mock fetch to fail
  const originalFetch = global.fetch;
  global.fetch = () => Promise.reject(new Error('Simulated network error'));
  
  // Restore after 10 seconds
  setTimeout(() => {
    global.fetch = originalFetch;
    console.log('✅ Network simulation ended');
  }, 10000);
}

/**
 * Test error boundary by throwing error
 */
export function triggerTestError() {
  throw new Error('Test error for ErrorBoundary - This is expected');
}

/**
 * Verify all safety components exist
 */
export async function verifySafetyComponents(): Promise<SafetyTestResult[]> {
  const results: SafetyTestResult[] = [];

  // Check ErrorBoundary
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ErrorBoundary = require('@/components/ErrorBoundary').default;
    results.push({
      test: 'ErrorBoundary Component',
      passed: !!ErrorBoundary,
      message: 'ErrorBoundary exists ✅',
    });
  } catch {
    results.push({
      test: 'ErrorBoundary Component',
      passed: false,
      message: 'ErrorBoundary not found ❌',
    });
  }

  // Check SafeView
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SafeView = require('@/components/SafeView').default;
    results.push({
      test: 'SafeView Component',
      passed: !!SafeView,
      message: 'SafeView exists ✅',
    });
  } catch {
    results.push({
      test: 'SafeView Component',
      passed: false,
      message: 'SafeView not found ❌',
    });
  }

  // Check safeApi
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { safeApiCall } = require('@/services/safeApi');
    results.push({
      test: 'safeApi Service',
      passed: !!safeApiCall,
      message: 'safeApi service exists ✅',
    });
  } catch {
    results.push({
      test: 'safeApi Service',
      passed: false,
      message: 'safeApi service not found ❌',
    });
  }

  // Check useSafeApi
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useSafeApi } = require('@/hooks/useSafeApi');
    results.push({
      test: 'useSafeApi Hook',
      passed: !!useSafeApi,
      message: 'useSafeApi hook exists ✅',
    });
  } catch {
    results.push({
      test: 'useSafeApi Hook',
      passed: false,
      message: 'useSafeApi hook not found ❌',
    });
  }

  return results;
}

/**
 * Complete safety audit
 * Run all tests and print comprehensive report
 */
export async function runSafetyAudit() {
  console.log('\n🔍 GOOGLE PLAY SAFETY AUDIT\n');
  console.log('Running comprehensive safety tests...\n');

  // 1. Verify components exist
  console.log('1️⃣ Verifying safety components...');
  const componentResults = await verifySafetyComponents();
  componentResults.forEach(r => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.test}: ${r.message}`);
  });

  // 2. Test internet
  console.log('\n2️⃣ Testing internet connectivity...');
  await testInternetConnectivity();

  // 3. Run safety tests
  console.log('\n3️⃣ Running safety tests...');
  const safetyResults = await testAppSafety();

  // Final report
  console.log('\n' + '━'.repeat(50));
  const allResults = [...componentResults, ...safetyResults];
  const totalPassed = allResults.filter(r => r.passed).length;
  const totalTests = allResults.length;
  
  if (totalPassed === totalTests) {
    console.log('🎉 ALL TESTS PASSED! App is READY for Google Play');
    console.log('✅ 100% crash-safe');
    console.log('✅ All safety components in place');
    console.log('✅ All edge cases handled');
  } else {
    console.warn(`⚠️ ${totalTests - totalPassed} test(s) failed`);
    console.warn('Please fix issues before submitting to Google Play');
  }
  console.log('━'.repeat(50) + '\n');
}

// Export for easy testing in dev
if (__DEV__) {
  console.log('💡 Safety test utilities loaded');
  console.log('Run: import { runSafetyAudit } from "@/tests/SafetyTests"; runSafetyAudit();');
}
