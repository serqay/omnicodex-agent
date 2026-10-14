import { listDirectory, readFile, writeFile, searchFiles } from './fileTools';
import { applyDiff, previewDiff } from './diffTools';
import { processManager, OutputCallback } from './commandTools';
import { DiffPreview, CommandPreview } from '../../shared/types';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'Recursively or shallowly inspect directory structure of the workspace, ignoring binary and build artifacts.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path to directory inside workspace. Use empty string or "." for workspace root.',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to list subdirectories recursively (default: false).',
          },
          max_depth: {
            type: 'number',
            description: 'Maximum depth for recursive listing (default: 3).',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a text file, optionally specifying a line range (1-indexed).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative or absolute path to the file.',
          },
          start_line: {
            type: 'number',
            description: 'Starting line number (1-indexed).',
          },
          end_line: {
            type: 'number',
            description: 'Ending line number (1-indexed, inclusive).',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create a new file or completely overwrite an existing file with the provided content.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path of the file to create or overwrite.',
          },
          content: {
            type: 'string',
            description: 'The complete new content of the file.',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_diff',
      description: 'Perform a targeted replacement in an existing file. Replaces the exact search_block with replace_block.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path of the target file.',
          },
          search_block: {
            type: 'string',
            description: 'The exact lines of code to find and replace. Must match existing file content.',
          },
          replace_block: {
            type: 'string',
            description: 'The new lines of code to substitute in place of search_block.',
          },
        },
        required: ['path', 'search_block', 'replace_block'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for text or regular expressions across code and text files in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The string or regex pattern to search for.',
          },
          regex: {
            type: 'boolean',
            description: 'Treat query as a regular expression (default: false).',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_command',
      description: 'Execute a terminal command (PowerShell / Bash) within the workspace directory and receive real-time stdout/stderr.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute (e.g. npm test, git status, cargo check).',
          },
          cwd: {
            type: 'string',
            description: 'Working directory. Defaults to workspace root if omitted.',
          },
        },
        required: ['command'],
      },
    },
  },
];

export async function generateToolPreview(
  workspacePath: string,
  name: string,
  args: Record<string, any>
): Promise<{ diffPreview?: DiffPreview; commandPreview?: CommandPreview }> {
  if (name === 'apply_diff') {
    try {
      const { preview } = await previewDiff(
        workspacePath,
        args.path,
        args.search_block,
        args.replace_block
      );
      return { diffPreview: preview };
    } catch {
      return {};
    }
  }

  if (name === 'write_file') {
    try {
      let originalContent = '';
      try {
        const readRes = await readFile(workspacePath, args.path);
        // readFile prefixes line numbers, get raw content
        const fs = await import('fs/promises');
        const { resolveSafePath } = await import('./fileTools');
        originalContent = await fs.readFile(resolveSafePath(workspacePath, args.path), 'utf-8');
      } catch {
        // file doesn't exist yet
      }
      const newContent = args.content || '';
      const lines = newContent.split(/\r?\n/).length;
      return {
        diffPreview: {
          path: args.path,
          relativePath: args.path,
          originalContent,
          newContent,
          addedLines: lines,
          deletedLines: originalContent ? originalContent.split(/\r?\n/).length : 0,
        },
      };
    } catch {
      return {};
    }
  }

  if (name === 'execute_command') {
    return {
      commandPreview: {
        command: args.command,
        cwd: args.cwd || workspacePath,
      },
    };
  }

  return {};
}

export async function executeTool(
  workspacePath: string,
  name: string,
  args: Record<string, any>,
  commandId?: string,
  onTerminalOutput?: OutputCallback
): Promise<any> {
  switch (name) {
    case 'list_directory': {
      return await listDirectory(
        workspacePath,
        args.path || '',
        args.recursive ?? false,
        args.max_depth ?? 3
      );
    }
    case 'read_file': {
      return await readFile(
        workspacePath,
        args.path,
        args.start_line,
        args.end_line
      );
    }
    case 'write_file': {
      return await writeFile(
        workspacePath,
        args.path,
        args.content
      );
    }
    case 'apply_diff': {
      return await applyDiff(
        workspacePath,
        args.path,
        args.search_block,
        args.replace_block
      );
    }
    case 'search_files': {
      return await searchFiles(
        workspacePath,
        args.query,
        args.regex ?? false
      );
    }
    case 'execute_command': {
      const execCwd = args.cwd || workspacePath;
      const cmdId = commandId || `cmd-${Date.now()}`;
      return await processManager.execute(
        cmdId,
        args.command,
        execCwd,
        onTerminalOutput
      );
    }
    default:
      throw new Error(`Unknown tool name: ${name}`);
  }
}
