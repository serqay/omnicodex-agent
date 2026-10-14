import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  writeFile,
  readFile,
  searchFiles,
} from '../src/main/tools/fileTools';
import {
  previewDiff,
  applyDiff,
} from '../src/main/tools/diffTools';
import { processManager } from '../src/main/tools/commandTools';

test('Edge Cases & Boundary Values Test Suite', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'omnicodex-edge-test-'));

  await t.test('writeFile handles empty string and deeply nested folders', async () => {
    const deepPath = 'a/b/c/d/e/empty.txt';
    const res = await writeFile(tmpDir, deepPath, '');
    assert.strictEqual(res.bytesWritten, 0);
    assert.strictEqual(res.lines, 1);

    const read = await readFile(tmpDir, deepPath);
    assert.strictEqual(read.totalLines, 1);
    assert.strictEqual(read.content, '1 | ');
  });

  await t.test('readFile with 0 or negative start line normalizes to 1', async () => {
    await writeFile(tmpDir, 'lines.txt', 'alpha\nbeta\ngamma');
    const res = await readFile(tmpDir, 'lines.txt', -5, 2);
    assert.strictEqual(res.startLine, 1);
    assert.strictEqual(res.endLine, 2);
    assert.ok(res.content.includes('1 | alpha'));
    assert.ok(res.content.includes('2 | beta'));
  });

  await t.test('readFile with start_line > totalLines returns friendly message', async () => {
    const res = await readFile(tmpDir, 'lines.txt', 999, 1000);
    assert.ok(res.content.includes('out of bounds'));
    assert.strictEqual(res.totalLines, 3);
  });

  await t.test('applyDiff allows deletion by passing empty replace_block', async () => {
    await writeFile(tmpDir, 'delete_test.ts', 'const a = 1;\nconst deleteMe = true;\nconst b = 2;');
    const { newContent } = await previewDiff(
      tmpDir,
      'delete_test.ts',
      'const deleteMe = true;\n',
      ''
    );
    assert.strictEqual(newContent, 'const a = 1;\nconst b = 2;');
  });

  await t.test('applyDiff handles unicode and emojis seamlessly', async () => {
    await writeFile(tmpDir, 'unicode.txt', 'Привет мир! 🚀\nGoodbye universe!');
    const res = await applyDiff(
      tmpDir,
      'unicode.txt',
      'Привет мир! 🚀',
      'Здравствуйте мир! ✨💻'
    );
    assert.ok(res.newContent.includes('Здравствуйте мир! ✨💻'));
  });

  await t.test('searchFiles returns empty list for non-matching query', async () => {
    const res = await searchFiles(tmpDir, 'non_existent_token_xyz_99999');
    assert.strictEqual(res.length, 0);
  });

  await t.test('execute_command with special characters, quotes, and pipes', async () => {
    const res = await processManager.execute(
      'special-chars-1',
      'echo "item1" | Out-String',
      tmpDir
    );
    assert.strictEqual(res.exitCode, 0);
    assert.ok(res.stdout.includes('item1'));
  });

  // Cleanup
  await fs.rm(tmpDir, { recursive: true, force: true });
});
