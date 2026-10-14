import test from 'node:test';
import assert from 'node:assert/strict';
import { processManager } from '../src/main/tools/commandTools';

test('Command Tools Test Suite', async (t) => {
  await t.test('execute runs shell command and captures stdout', async () => {
    let captured = '';
    const res = await processManager.execute(
      'test-cmd-1',
      'echo "omnicodex-ok"',
      process.cwd(),
      (chunk) => {
        captured += chunk;
      }
    );

    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stdout.includes('omnicodex-ok'));
    assert.ok(captured.includes('omnicodex-ok'));
    assert.ok(res.durationMs >= 0);
  });

  await t.test('execute captures exit code on failure', async () => {
    const res = await processManager.execute(
      'test-cmd-err',
      'exit 42',
      process.cwd()
    );

    assert.strictEqual(res.exitCode, 42);
  });
});
