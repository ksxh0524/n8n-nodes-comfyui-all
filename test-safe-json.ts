import { safeJsonParse } from './nodes/validation';

console.log('Testing safeJsonParse function...\n');

const testCases = [
  {
    name: 'Valid JSON',
    input: '{"test": "value", "number": 123}',
    shouldPass: true,
  },
  {
    name: 'Invalid JSON',
    input: '{"test": invalid}',
    shouldPass: false,
  },
  {
    name: 'Empty JSON',
    input: '',
    shouldPass: false,
  },
  {
    name: 'Deep JSON (within limit)',
    input: JSON.stringify({ a: { b: { c: { d: { e: { f: { g: { h: { i: { j: {} } } } } } } } } }),
    shouldPass: true,
  },
];

for (const testCase of testCases) {
  try {
    const result = safeJsonParse(testCase.input, testCase.name);
    if (testCase.shouldPass) {
      console.log(`✓ ${testCase.name}: PASSED`);
    } else {
      console.log(`✗ ${testCase.name}: FAILED (expected to fail but passed)`);
    }
  } catch (error: any) {
    if (!testCase.shouldPass) {
      console.log(`✓ ${testCase.name}: PASSED (correctly rejected)`);
    } else {
      console.log(`✗ ${testCase.name}: FAILED - ${error.message}`);
    }
  }
}

const largeJson = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024) });
console.log('\nTesting size limit...');
try {
  safeJsonParse(largeJson, 'Large JSON');
  console.log('✗ Size limit test: FAILED (should have rejected large JSON)');
} catch (error: any) {
  console.log(`✓ Size limit test: PASSED - ${error.message}`);
}

console.log('\nAll tests completed!');
