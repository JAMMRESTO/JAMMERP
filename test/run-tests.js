// Test runner — discovers and executes all test files in test/ directory
// Uses a simple assertion-based framework (no external dependencies)
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const passed = [];
const failed = [];

async function run() {
  const files = readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f !== 'run-tests.js');

  for (const file of files) {
    const filePath = join(__dirname, file);
    const mod = await import(filePath);

    const testFns = Object.entries(mod).filter(([k]) => k.startsWith('test'));
    for (const [name, fn] of testFns) {
      try {
        await fn();
        passed.push(name);
        console.log(`  ✓ ${name}`);
      } catch (err) {
        failed.push({ name, error: err });
        console.log(`  ✗ ${name}`);
        console.log(`    ${err.message || err}`);
      }
    }
  }

  console.log(`\n${passed.length} passed, ${failed.length} failed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
