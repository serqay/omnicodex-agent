import fs from 'fs/promises';
import path from 'path';
import { FileNode } from '../../shared/types';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.vite',
  '.cache',
  'coverage',
  '.gemini',
  '.agents',
  '.turbo',
  'out',
  'target',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.exe', '.dll',
  '.so', '.dylib', '.bin', '.iso', '.mp4', '.mp3', '.wav',
  '.woff', '.woff2', '.ttf', '.eot',
]);

export interface GitIgnoreRule {
  pattern: RegExp;
  negate: boolean;
  directoryOnly: boolean;
}

export function parseGitIgnore(content: string): GitIgnoreRule[] {
  const rules: GitIgnoreRule[] = [];
  const lines = content.split(/\r?\n/);

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    let negate = false;
    if (line.startsWith('!')) {
      negate = true;
      line = line.slice(1).trim();
    }
    if (!line) continue;

    let directoryOnly = false;
    if (line.endsWith('/')) {
      directoryOnly = true;
      line = line.slice(0, -1);
    }
    if (!line) continue;

    const isRootAnchored = line.startsWith('/');
    if (isRootAnchored) {
      line = line.slice(1);
    }

    let regexPattern = '';
    let i = 0;
    while (i < line.length) {
      const char = line[i];
      if (char === '*' && line[i + 1] === '*') {
        if (line[i + 2] === '/') {
          regexPattern += '(?:.*/)?';
          i += 3;
        } else {
          regexPattern += '.*';
          i += 2;
        }
      } else if (char === '*') {
        regexPattern += '[^/]*';
        i++;
      } else if (char === '?') {
        regexPattern += '[^/]';
        i++;
      } else if (['.', '(', ')', '+', '^', '$', '[', ']', '{', '}', '|', '\\'].includes(char)) {
        regexPattern += '\\' + char;
        i++;
      } else {
        regexPattern += char;
        i++;
      }
    }

    if (isRootAnchored || line.includes('/')) {
      regexPattern = '^' + regexPattern + '(?:/.*)?$';
    } else {
      regexPattern = '(?:^|/)' + regexPattern + '(?:/.*)?$';
    }

    try {
      const regexFlags = process.platform === 'win32' ? 'i' : '';
      rules.push({
        pattern: new RegExp(regexPattern, regexFlags),
        negate,
        directoryOnly,
      });
    } catch {
      // Ignore invalid regex
    }
  }

  return rules;
}

export async function loadGitIgnoreRules(workspacePath: string): Promise<GitIgnoreRule[]> {
  try {
    const gitignorePath = path.join(workspacePath, '.gitignore');
    const content = await fs.readFile(gitignorePath, 'utf-8');
    return parseGitIgnore(content);
  } catch {
    return [];
  }
}

export function isPathIgnored(
  relPath: string,
  isDirectory: boolean,
  rules: GitIgnoreRule[]
): boolean {
  if (rules.length === 0) return false;
  const cleanPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  let ignored = false;

  for (const rule of rules) {
    if (rule.directoryOnly && !isDirectory) {
      continue;
    }
    if (rule.pattern.test(cleanPath)) {
      ignored = !rule.negate;
    }
  }

  return ignored;
}

export const MAX_READ_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit
export const MAX_SEARCH_FILE_SIZE = 2 * 1024 * 1024; // 2 MB limit for search

export function resolveSafePath(workspacePath: string, targetPath: string): string {
  const normalizedWs = path.resolve(workspacePath);
  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(normalizedWs, targetPath);

  const rel = path.relative(normalizedWs, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `Security Violation: Path '${targetPath}' traverses outside workspace root '${workspacePath}'`
    );
  }
  return resolved;
}

export async function listDirectory(
  workspacePath: string,
  relPath = '',
  recursive = false,
  maxDepth = 3,
  currentDepth = 0,
  rules?: GitIgnoreRule[]
): Promise<FileNode[]> {
  const targetDir = resolveSafePath(workspacePath, relPath);
  try {
    const gitRules = rules || (currentDepth === 0 ? await loadGitIgnoreRules(workspacePath) : []);
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const results: FileNode[] = [];

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(targetDir, entry.name);
      const entryRelPath = path.relative(workspacePath, fullPath).replace(/\\/g, '/');
      const isDirectory = entry.isDirectory();

      if (gitRules.length > 0 && isPathIgnored(entryRelPath, isDirectory, gitRules)) {
        continue;
      }

      const node: FileNode = {
        name: entry.name,
        path: fullPath,
        relativePath: entryRelPath,
        isDirectory,
        extension: isDirectory ? undefined : path.extname(entry.name).toLowerCase(),
      };

      if (!isDirectory) {
        try {
          const stat = await fs.stat(fullPath);
          node.size = stat.size;
        } catch {
          // ignore stat errors
        }
      }

      if (isDirectory && recursive && currentDepth < maxDepth) {
        node.children = await listDirectory(
          workspacePath,
          entryRelPath,
          true,
          maxDepth,
          currentDepth + 1,
          gitRules
        );
      }

      results.push(node);
    }

    // Sort directories first, then alphabetically
    return results.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });
  } catch (error: any) {
    throw new Error(`Failed to list directory '${relPath}': ${error.message}`);
  }
}

export async function readFile(
  workspacePath: string,
  relPath: string,
  startLine?: number,
  endLine?: number
): Promise<{ content: string; rawContent: string; totalLines: number; startLine: number; endLine: number }> {
  const filePath = resolveSafePath(workspacePath, relPath);
  const ext = path.extname(filePath).toLowerCase();

  if (BINARY_EXTENSIONS.has(ext)) {
    throw new Error(`File '${relPath}' appears to be a binary file and cannot be read as text.`);
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_READ_FILE_SIZE) {
      throw new Error(
        `File '${relPath}' size (${(stat.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed read limit (10 MB).`
      );
    }

    const raw = await fs.readFile(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const totalLines = lines.length;

    const start = Math.max(1, startLine || 1);
    const end = Math.min(totalLines, endLine || totalLines);

    if (start > totalLines) {
      return {
        content: `[File has only ${totalLines} lines. Requested start line ${start} is out of bounds.]`,
        rawContent: '',
        totalLines,
        startLine: start,
        endLine: end,
      };
    }

    const selectedLines = lines.slice(start - 1, end);
    const numberedContent = selectedLines
      .map((line, idx) => `${start + idx} | ${line}`)
      .join('\n');
    const rawContent = selectedLines.join('\n');

    return {
      content: numberedContent,
      rawContent,
      totalLines,
      startLine: start,
      endLine: end,
    };
  } catch (error: any) {
    throw new Error(`Failed to read file '${relPath}': ${error.message}`);
  }
}

export async function writeFile(
  workspacePath: string,
  relPath: string,
  content: string
): Promise<{ path: string; bytesWritten: number; lines: number }> {
  const filePath = resolveSafePath(workspacePath, relPath);
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    const lines = content.split(/\r?\n/).length;
    return {
      path: filePath,
      bytesWritten: Buffer.byteLength(content, 'utf-8'),
      lines,
    };
  } catch (error: any) {
    throw new Error(`Failed to write file '${relPath}': ${error.message}`);
  }
}

export async function searchFiles(
  workspacePath: string,
  query: string,
  isRegex = false,
  maxResults = 50
): Promise<Array<{ file: string; line: number; match: string }>> {
  const results: Array<{ file: string; line: number; match: string }> = [];
  let regex: RegExp | null = null;
  if (isRegex) {
    try {
      regex = new RegExp(query, 'i');
    } catch (err: any) {
      throw new Error(`Invalid regular expression '${query}': ${err.message}`);
    }
  }
  const lowerQuery = query.toLowerCase();
  const gitRules = await loadGitIgnoreRules(workspacePath);

  async function scanDir(currentDir: string) {
    if (results.length >= maxResults) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      const isDirectory = entry.isDirectory();
      const relPath = path.relative(workspacePath, fullPath).replace(/\\/g, '/');

      if (gitRules.length > 0 && isPathIgnored(relPath, isDirectory, gitRules)) {
        continue;
      }

      if (isDirectory) {
        await scanDir(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (BINARY_EXTENSIONS.has(ext)) continue;

        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > MAX_SEARCH_FILE_SIZE) continue;

          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split(/\r?\n/);

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let matched = false;
            if (regex) {
              matched = regex.test(line);
            } else {
              matched = line.toLowerCase().includes(lowerQuery);
            }

            if (matched) {
              results.push({
                file: relPath,
                line: i + 1,
                match: line.trim().slice(0, 300),
              });
              if (results.length >= maxResults) break;
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await scanDir(workspacePath);
  return results;
}
