import fs from 'fs/promises';
import path from 'path';
import { DiffPreview } from '../../shared/types';
import { resolveSafePath } from './fileTools';

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

export function computeLineChanges(oldBlock: string, newBlock: string): { addedLines: number; deletedLines: number } {
  const oldLines = oldBlock ? oldBlock.split(/\r?\n/) : [];
  const newLines = newBlock ? newBlock.split(/\r?\n/) : [];

  const m = oldLines.length;
  const n = newLines.length;

  if (m === 0) return { addedLines: n, deletedLines: 0 };
  if (n === 0) return { addedLines: 0, deletedLines: m };

  // Compute Longest Common Subsequence (LCS) table for accurate line deltas
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs = dp[m][n];
  const deletedLines = m - lcs;
  const addedLines = n - lcs;

  return { addedLines, deletedLines };
}

export async function previewDiff(
  workspacePath: string,
  relPath: string,
  searchBlock: string,
  replaceBlock: string
): Promise<{ preview: DiffPreview; newContent: string }> {
  if (!searchBlock || searchBlock.length === 0) {
    throw new Error('Search block cannot be empty. Please specify the exact code block to find and replace.');
  }

  const filePath = resolveSafePath(workspacePath, relPath);
  const original = await fs.readFile(filePath, 'utf-8');

  // Normalize line endings for comparison
  const isCrlf = original.includes('\r\n');
  const normalizedOriginal = original.replace(/\r\n/g, '\n');
  const normalizedSearch = searchBlock.replace(/\r\n/g, '\n');
  const normalizedReplace = replaceBlock.replace(/\r\n/g, '\n');

  let newNormalized: string;
  const matchIndex = normalizedOriginal.indexOf(normalizedSearch);

  if (matchIndex !== -1) {
    // Check for uniqueness
    const secondMatch = normalizedOriginal.indexOf(normalizedSearch, matchIndex + 1);
    if (secondMatch !== -1) {
      throw new Error(
        `Ambiguous search block: found multiple occurrences in '${relPath}'. Include more unique surrounding lines.`
      );
    }
    newNormalized =
      normalizedOriginal.substring(0, matchIndex) +
      normalizedReplace +
      normalizedOriginal.substring(matchIndex + normalizedSearch.length);
  } else {
    // Try relaxed whitespace line-by-line matching
    const origLines = normalizedOriginal.split('\n');
    const searchLines = normalizedSearch.split('\n');

    let matchLineStart = -1;
    let matchCount = 0;

    for (let i = 0; i <= origLines.length - searchLines.length; i++) {
      let allMatch = true;
      for (let j = 0; j < searchLines.length; j++) {
        if (origLines[i + j].trim() !== searchLines[j].trim()) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        matchCount++;
        matchLineStart = i;
      }
    }

    if (matchCount === 1 && matchLineStart !== -1) {
      const before = origLines.slice(0, matchLineStart);
      const after = origLines.slice(matchLineStart + searchLines.length);
      newNormalized = [...before, normalizedReplace, ...after].join('\n');
    } else if (matchCount > 1) {
      throw new Error(
        `Ambiguous search block: found ${matchCount} loose matches in '${relPath}'. Provide additional context.`
      );
    } else {
      throw new Error(
        `Search block was not found in '${relPath}'. Verify line indentation and exact characters.`
      );
    }
  }

  const finalNewContent = isCrlf ? newNormalized.replace(/\n/g, '\r\n') : newNormalized;
  const changes = computeLineChanges(searchBlock, replaceBlock);

  const preview: DiffPreview = {
    path: filePath,
    relativePath: path.relative(workspacePath, filePath).replace(/\\/g, '/'),
    originalContent: original,
    newContent: finalNewContent,
    searchBlock,
    replaceBlock,
    addedLines: changes.addedLines,
    deletedLines: changes.deletedLines,
  };

  return { preview, newContent: finalNewContent };
}

export async function applyDiff(
  workspacePath: string,
  relPath: string,
  searchBlock: string,
  replaceBlock: string
): Promise<DiffPreview> {
  const { preview, newContent } = await previewDiff(
    workspacePath,
    relPath,
    searchBlock,
    replaceBlock
  );
  await fs.writeFile(preview.path, newContent, 'utf-8');
  return preview;
}
