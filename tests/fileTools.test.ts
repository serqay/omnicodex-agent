import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  writeFile,
  readFile,
  listDirectory,
  searchFiles,
  resolveSafePath,
  parseGitIgnore,
  loadGitIgnoreRules,
  isPathIgnored,
} from '../src/main/tools/fileTools';

test('File Tools Test Suite', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'omnicodex-test-'));

  await t.test('writeFile creates new file with parent directories', async () => {
    const res = await writeFile(tmpDir, 'subdir/hello.txt', 'Line 1\nLine 2\nLine 3');
    assert.strictEqual(res.lines, 3);
    assert.ok(res.bytesWritten > 0);

    const actual = await fs.readFile(path.join(tmpDir, 'subdir/hello.txt'), 'utf-8');
    assert.strictEqual(actual, 'Line 1\nLine 2\nLine 3');
  });

  await t.test('readFile reads full content with line numbers', async () => {
    const res = await readFile(tmpDir, 'subdir/hello.txt');
    assert.strictEqual(res.totalLines, 3);
    assert.strictEqual(res.startLine, 1);
    assert.strictEqual(res.endLine, 3);
    assert.ok(res.content.includes('1 | Line 1'));
    assert.ok(res.content.includes('3 | Line 3'));
  });

  await t.test('readFile reads sliced line ranges', async () => {
    const res = await readFile(tmpDir, 'subdir/hello.txt', 2, 2);
    assert.strictEqual(res.startLine, 2);
    assert.strictEqual(res.endLine, 2);
    assert.strictEqual(res.content, '2 | Line 2');
  });

  await t.test('readFile handles out of bounds lines gracefully', async () => {
    const res = await readFile(tmpDir, 'subdir/hello.txt', 10, 20);
    assert.ok(res.content.includes('out of bounds'));
  });

  await t.test('listDirectory lists files and folders', async () => {
    await writeFile(tmpDir, 'root.js', 'console.log(1);');
    const nodes = await listDirectory(tmpDir, '', true, 3);
    assert.ok(nodes.length >= 2);

    const hasSubdir = nodes.some((n) => n.name === 'subdir' && n.isDirectory);
    const hasRootJs = nodes.some((n) => n.name === 'root.js' && !n.isDirectory);
    assert.ok(hasSubdir);
    assert.ok(hasRootJs);
  });

  await t.test('searchFiles finds occurrences of query', async () => {
    const results = await searchFiles(tmpDir, 'Line 2');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].line, 2);
    assert.ok(results[0].file.includes('hello.txt'));
  });

  await t.test('readFile returns unmodified rawContent', async () => {
    const res = await readFile(tmpDir, 'subdir/hello.txt');
    assert.strictEqual(res.rawContent, 'Line 1\nLine 2\nLine 3');
  });

  await t.test('parseGitIgnore and isPathIgnored match patterns accurately', () => {
    const gitignoreContent = [
      '# Comment line',
      '*.secret',
      'logs/',
      '!important.secret',
      '/config/local.json',
    ].join('\n');

    const rules = parseGitIgnore(gitignoreContent);
    assert.strictEqual(rules.length, 4);

    assert.strictEqual(isPathIgnored('app.secret', false, rules), true);
    assert.strictEqual(isPathIgnored('sub/nested/app.secret', false, rules), true);
    assert.strictEqual(isPathIgnored('important.secret', false, rules), false); // negated
    assert.strictEqual(isPathIgnored('logs', true, rules), true); // directory
    assert.strictEqual(isPathIgnored('logs', false, rules), false); // directoryOnly rule on file
    assert.strictEqual(isPathIgnored('config/local.json', false, rules), true);
    assert.strictEqual(isPathIgnored('other/config/local.json', false, rules), false); // anchored
  });

  await t.test('listDirectory and searchFiles respect workspace .gitignore file', async () => {
    await writeFile(tmpDir, '.gitignore', 'ignore_me/\n*.log\n');
    await writeFile(tmpDir, 'ignore_me/hidden.txt', 'secret content');
    await writeFile(tmpDir, 'test.log', 'logged content');
    await writeFile(tmpDir, 'visible.txt', 'normal content');

    const tree = await listDirectory(tmpDir, '', true, 3);
    const names = tree.map((n) => n.name);
    assert.ok(names.includes('visible.txt'));
    assert.ok(!names.includes('ignore_me'));
    assert.ok(!names.includes('test.log'));

    const searchResults = await searchFiles(tmpDir, 'content');
    const matchedFiles = searchResults.map((r) => r.file);
    assert.ok(matchedFiles.some((f) => f.includes('visible.txt')));
    assert.ok(!matchedFiles.some((f) => f.includes('test.log')));
    assert.ok(!matchedFiles.some((f) => f.includes('hidden.txt')));
  });

  await t.test('resolveSafePath blocks path traversal outside workspace', () => {
    assert.throws(
      () => resolveSafePath(tmpDir, '../../etc/passwd'),
      /Security Violation/
    );
    assert.throws(
      () => resolveSafePath(tmpDir, path.resolve(os.tmpdir(), 'outside_file.txt')),
      /Security Violation/
    );
    // Relative safe path resolves cleanly
    const safe = resolveSafePath(tmpDir, 'subdir/file.txt');
    assert.ok(safe.startsWith(path.resolve(tmpDir)));
  });

  await t.test('searchFiles throws friendly error on invalid regex', async () => {
    await assert.rejects(
      async () => searchFiles(tmpDir, '[unclosed-bracket', true),
      /Invalid regular expression/
    );
  });

  // Cleanup
  await fs.rm(tmpDir, { recursive: true, force: true });
});
