import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  previewDiff,
  applyDiff,
  computeLineChanges,
} from '../src/main/tools/diffTools';
import { writeFile } from '../src/main/tools/fileTools';

test('Diff Tools Test Suite', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'omnicodex-diff-test-'));

  await t.test('computeLineChanges accurately counts line deltas', () => {
    const oldCode = 'function a() {\n  return 1;\n}';
    const newCode = 'function a() {\n  // comment\n  return 2;\n}';
    const changes = computeLineChanges(oldCode, newCode);
    assert.strictEqual(changes.addedLines, 2);
    assert.strictEqual(changes.deletedLines, 1);
  });

  await t.test('computeLineChanges accurately counts duplicate line additions and deletions', () => {
    // When adding duplicate lines
    const orig = 'item\nitem';
    const addedDup = 'item\nitem\nitem\nitem';
    const changes1 = computeLineChanges(orig, addedDup);
    assert.strictEqual(changes1.addedLines, 2);
    assert.strictEqual(changes1.deletedLines, 0);

    // When deleting duplicate lines
    const changes2 = computeLineChanges(addedDup, orig);
    assert.strictEqual(changes2.addedLines, 0);
    assert.strictEqual(changes2.deletedLines, 2);
  });

  await t.test('previewDiff finds exact match and previews replacement', async () => {
    const file = 'main.ts';
    await writeFile(
      tmpDir,
      file,
      'const port = 3000;\nconsole.log(port);\nexport default port;'
    );

    const { preview, newContent } = await previewDiff(
      tmpDir,
      file,
      'const port = 3000;\nconsole.log(port);',
      'const port = 8080;\nconsole.log("Listening on " + port);'
    );

    assert.ok(newContent.includes('const port = 8080;'));
    assert.ok(newContent.includes('export default port;'));
    assert.strictEqual(preview.relativePath, 'main.ts');
    assert.ok(preview.addedLines >= 1);
  });

  await t.test('previewDiff handles loose trailing whitespace differences', async () => {
    const file = 'loose.ts';
    await writeFile(tmpDir, file, 'function test() {   \n  return true;  \n}');

    const { newContent } = await previewDiff(
      tmpDir,
      file,
      'function test() {\n  return true;\n}',
      'function test() {\n  return false;\n}'
    );

    assert.ok(newContent.includes('return false;'));
  });

  await t.test('previewDiff throws on non-existent search block', async () => {
    const file = 'missing.ts';
    await writeFile(tmpDir, file, 'const x = 10;');

    await assert.rejects(
      async () => {
        await previewDiff(tmpDir, file, 'const nonExistent = 999;', 'const y = 20;');
      },
      /Search block was not found/
    );
  });

  await t.test('previewDiff throws on ambiguous multiple occurrences', async () => {
    const file = 'ambiguous.ts';
    await writeFile(tmpDir, file, 'let a = 1;\nlet b = 2;\nlet a = 1;');

    await assert.rejects(
      async () => {
        await previewDiff(tmpDir, file, 'let a = 1;', 'let a = 5;');
      },
      /Ambiguous search block/
    );
  });

  await t.test('applyDiff writes updated content to disk', async () => {
    const file = 'apply.ts';
    await writeFile(tmpDir, file, 'const greeting = "hello";');

    const preview = await applyDiff(
      tmpDir,
      file,
      'const greeting = "hello";',
      'const greeting = "world";'
    );

    assert.strictEqual(preview.relativePath, 'apply.ts');
    const diskContent = await fs.readFile(path.join(tmpDir, file), 'utf-8');
    assert.strictEqual(diskContent, 'const greeting = "world";');
  });

  // Cleanup
  await fs.rm(tmpDir, { recursive: true, force: true });
});
