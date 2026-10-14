import fs from 'fs/promises';
import path from 'path';
import { DiffPreview } from '../../shared/types';
import { resolveSafePath } from './fileTools';

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

export function computeLineChanges(oldText: string, newText: string): { addedLines: number; deletedLines: number } {
  const oldLines = oldText ? oldText.split(/\r?\n/) : [];
  const newLines = newText ? newText.split(/\r?\n/) : [];

  const oldCounts = new Map<string, number>();
  for (const line of oldLines) {
    oldCounts.set(line, (oldCounts.get(line) || 0) + 1);
  }

  const newCounts = new Map<string, number>();
  for (const line of newLines) {
    newCounts.set(line, (newCounts.get(line) || 0) + 1);
  }

  let added = 0;
  let deleted = 0;

  for (const [line, count] of newCounts) {
    const oldCount = oldCounts.get(line) || 0;
    if (count > oldCount) {
      added += count - oldCount;
    }
  }

  for (const [line, count] of oldCounts) {
    const newCount = newCounts.get(line) || 0;
    if (count > newCount) {
      deleted += count - newCount;
    }
  }

  return { addedLines: added, deletedLines: deleted };
}

export async function previewDiff(
  workspacePath: string,
  relPath: string,
  searchBlock: string,
  replaceBlock: string
): Promise<{ preview: DiffPreview; newContent: string }> {
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
        if (origLines[i + j].trimEnd() !== searchLines[j].trimEnd()) {
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
  const changes = computeLineChanges(original, finalNewContent);

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
