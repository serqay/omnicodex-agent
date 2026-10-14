import { WebContents } from 'electron';
import { StorageManager } from './storage';
import { omniRouterClient } from './omnirouter';
import { executeTool, generateToolPreview } from './tools';
import { readFile } from './tools/fileTools';
import { workspaceManager } from './workspace';
import { processManager } from './tools/commandTools';
import {
  ChatMessage,
  ChatSession,
  OmniRouterConfig,
  StreamChunkEvent,
  ToolCall,
} from '../shared/types';
import { IPC_CHANNELS } from '../shared/ipc';

interface PendingApproval {
  resolve: (value: { approved: boolean; feedback?: string }) => void;
}

export class AgentLoopManager {
  private activeControllers = new Map<string, AbortController>();
  private pendingApprovals = new Map<string, PendingApproval>();

  constructor(private storage: StorageManager) {}

  approveTool(toolId: string): boolean {
    const pending = this.pendingApprovals.get(toolId);
    if (pending) {
      pending.resolve({ approved: true });
      this.pendingApprovals.delete(toolId);
      return true;
    }
    return false;
  }

  rejectTool(toolId: string, feedback?: string): boolean {
    const pending = this.pendingApprovals.get(toolId);
    if (pending) {
      pending.resolve({ approved: false, feedback: feedback || 'Rejected by user' });
      this.pendingApprovals.delete(toolId);
      return true;
    }
    return false;
  }

  cancel(sessionId: string): void {
    const controller = this.activeControllers.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(sessionId);
    }
    // Reject any pending tool approvals for this session
    for (const [id, pending] of this.pendingApprovals) {
      pending.resolve({ approved: false, feedback: 'Operation cancelled by user' });
      this.pendingApprovals.delete(id);
    }
    processManager.killAll();
  }

  async runLoop(
    session: ChatSession,
    userPrompt: string,
    attachedFiles: string[] = [],
    webContents: WebContents
  ): Promise<ChatSession> {
    const config: OmniRouterConfig = await this.storage.getConfig();

    if (!config.apiKey && !config.baseUrl.includes('localhost') && !config.baseUrl.includes('127.0.0.1')) {
      throw new Error('OmniRouter API key is not configured. Please open Settings and enter your API Key.');
    }

    const abortController = new AbortController();
    this.activeControllers.set(session.id, abortController);

    const workspacePath = session.workspacePath || workspaceManager.getWorkspace();

    // 1. Prepare attached files context if any
    let fileContextBlock = '';
    if (attachedFiles.length > 0) {
      fileContextBlock += '\n\n=== ATTACHED CONTEXT FILES ===\n';
      for (const file of attachedFiles) {
        try {
          const res = await readFile(workspacePath, file);
          fileContextBlock += `\n--- File: ${file} (${res.totalLines} lines) ---\n${res.content}\n`;
        } catch (err: any) {
          fileContextBlock += `\n--- File: ${file} (Failed to read: ${err.message}) ---\n`;
        }
      }
      fileContextBlock += '=== END ATTACHED FILES ===\n\n';
    }

    // 2. Add user message
    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: userPrompt,
      attachedFiles,
      timestamp: Date.now(),
    };
    session.messages.push(userMessage);
    await this.storage.saveSession(session);

    const maxIterations = 25;
    let iteration = 0;
    let isLoopCompleted = false;

    try {
      while (iteration < maxIterations) {
        iteration++;

        if (abortController.signal.aborted) {
          break;
        }

        // Build messages payload for OmniRouter API
        const apiMessages: Array<{ role: string; content: string; name?: string; tool_call_id?: string; tool_calls?: any[] }> = [
          {
            role: 'system',
            content: `${config.systemPrompt}\n\nCURRENT WORKSPACE ROOT DIRECTORY: "${workspacePath}"`,
          },
        ];

        for (const msg of session.messages) {
          if (msg.role === 'user') {
            const extra = (msg.id === userMessage.id && fileContextBlock) ? fileContextBlock : '';
            apiMessages.push({
              role: 'user',
              content: `${msg.content}${extra}`,
            });
          } else if (msg.role === 'assistant') {
            const formattedToolCalls = msg.toolCalls?.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
              },
            }));

            apiMessages.push({
              role: 'assistant',
              content: msg.content ? msg.content : (formattedToolCalls && formattedToolCalls.length > 0 ? null : '') as any,
              ...(formattedToolCalls && formattedToolCalls.length > 0 ? { tool_calls: formattedToolCalls } : {}),
            });
          } else if (msg.role === 'tool') {
            apiMessages.push({
              role: 'tool',
              tool_call_id: msg.toolCallId,
              name: msg.name,
              content: msg.content,
            });
          }
        }

        const assistantMsgId = `msg_asst_${Date.now()}`;
        const activeModel = config.customModelId.trim() || config.selectedModel;

        let streamResult: any;
        try {
          streamResult = await omniRouterClient.streamChat(
            config.baseUrl,
            config.apiKey,
            activeModel,
            apiMessages,
            {
              temperature: config.temperature,
              maxTokens: config.maxTokens,
              abortSignal: abortController.signal,
              onDeltaText: (delta) => {
                if (!webContents.isDestroyed()) {
                  webContents.send(IPC_CHANNELS.EVENT_STREAM_CHUNK, {
                    sessionId: session.id,
                    messageId: assistantMsgId,
                    deltaText: delta,
                  } as StreamChunkEvent);
                }
              },
              onDeltaReasoning: (delta) => {
                if (!webContents.isDestroyed()) {
                  webContents.send(IPC_CHANNELS.EVENT_STREAM_CHUNK, {
                    sessionId: session.id,
                    messageId: assistantMsgId,
                    deltaReasoning: delta,
                  } as StreamChunkEvent);
                }
              },
              onDeltaToolCall: (idx, id, name, argsChunk) => {
                if (!webContents.isDestroyed()) {
                  webContents.send(IPC_CHANNELS.EVENT_STREAM_CHUNK, {
                    sessionId: session.id,
                    messageId: assistantMsgId,
                    toolCallDelta: {
                      index: idx,
                      id,
                      name,
                      argumentsDelta: argsChunk,
                    },
                  } as StreamChunkEvent);
                }
              },
            }
          );
        } catch (err: any) {
          if (abortController.signal.aborted) {
            break;
          }
          throw err;
        }

        // Create Assistant Message
        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          content: streamResult.content,
          reasoningContent: streamResult.reasoningContent || undefined,
          toolCalls: streamResult.toolCalls.length > 0 ? streamResult.toolCalls : undefined,
          tokenUsage: streamResult.tokenUsage,
          timestamp: Date.now(),
        };

        session.messages.push(assistantMessage);
        await this.storage.saveSession(session);

        // If no tools requested, assistant is done!
        if (streamResult.toolCalls.length === 0) {
          isLoopCompleted = true;
          if (!webContents.isDestroyed()) {
            webContents.send(IPC_CHANNELS.EVENT_STREAM_CHUNK, {
              sessionId: session.id,
              messageId: assistantMsgId,
              finished: true,
              finishReason: streamResult.finishReason || 'stop',
              tokenUsage: streamResult.tokenUsage,
            } as StreamChunkEvent);
          }
          break;
        }

        // Tool calls exist: notify UI that this intermediate stream chunk completed
        if (!webContents.isDestroyed()) {
          webContents.send(IPC_CHANNELS.EVENT_STREAM_CHUNK, {
            sessionId: session.id,
            messageId: assistantMsgId,
            finished: false,
            finishReason: 'tool_calls',
            tokenUsage: streamResult.tokenUsage,
          } as StreamChunkEvent);
        }

        // Handle Tool Calls
        for (const tool of streamResult.toolCalls) {
          if (abortController.signal.aborted) break;

          const isMutationTool = ['apply_diff', 'write_file', 'execute_command'].includes(tool.name);
          const needsApproval = config.safeMode && isMutationTool;

          // Generate preview for diff or command
          const previews = await generateToolPreview(workspacePath, tool.name, tool.arguments);
          tool.diffPreview = previews.diffPreview;
          tool.commandPreview = previews.commandPreview;

          if (needsApproval) {
            tool.status = 'pending_approval';
            if (!webContents.isDestroyed()) {
              webContents.send(IPC_CHANNELS.EVENT_TOOL_CALL, {
                sessionId: session.id,
                messageId: assistantMsgId,
                tool,
              });
            }

            // Wait for user approval or rejection
            const approval = await new Promise<{ approved: boolean; feedback?: string }>((resolve) => {
              this.pendingApprovals.set(tool.id, { resolve });
            });

            if (!approval.approved) {
              tool.status = 'rejected';
              tool.error = approval.feedback || 'User rejected this operation.';
              if (!webContents.isDestroyed()) {
                webContents.send(IPC_CHANNELS.EVENT_TOOL_CALL, {
                  sessionId: session.id,
                  messageId: assistantMsgId,
                  tool,
                });
              }

              // Append tool response as rejection message
              session.messages.push({
                id: `msg_tool_${Date.now()}_${tool.id}`,
                role: 'tool',
                toolCallId: tool.id,
                name: tool.name,
                content: `Action rejected: ${tool.error}`,
                timestamp: Date.now(),
              });
              await this.storage.saveSession(session);
              continue;
            }
          }

          // Execute tool (Approved or YOLO mode)
          tool.status = 'running';
          if (!webContents.isDestroyed()) {
            webContents.send(IPC_CHANNELS.EVENT_TOOL_CALL, {
              sessionId: session.id,
              messageId: assistantMsgId,
              tool,
            });
          }

          const toolStart = Date.now();
          let toolResult: any;
          try {
            toolResult = await executeTool(
              workspacePath,
              tool.name,
              tool.arguments,
              tool.id,
              (chunk, type) => {
                if (!webContents.isDestroyed()) {
                  webContents.send(IPC_CHANNELS.EVENT_TERMINAL_OUTPUT, {
                    commandId: tool.id,
                    data: chunk,
                    type,
                  });
                }
              }
            );

            tool.status = 'completed';
            tool.result = toolResult;
            tool.durationMs = Date.now() - toolStart;
          } catch (err: any) {
            tool.status = 'error';
            tool.error = err.message || 'Tool execution failed';
            tool.durationMs = Date.now() - toolStart;
            toolResult = { error: tool.error };
          }

          if (!webContents.isDestroyed()) {
            webContents.send(IPC_CHANNELS.EVENT_TOOL_CALL, {
              sessionId: session.id,
              messageId: assistantMsgId,
              tool,
            });
          }

          // Append tool result message to conversation
          const resultStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
          session.messages.push({
            id: `msg_tool_${Date.now()}_${tool.id}`,
            role: 'tool',
            toolCallId: tool.id,
            name: tool.name,
            content: resultStr,
            timestamp: Date.now(),
          });
          await this.storage.saveSession(session);
        }
      }
    } finally {
      this.activeControllers.delete(session.id);
      if (!isLoopCompleted && !webContents.isDestroyed()) {
        webContents.send(IPC_CHANNELS.EVENT_STREAM_CHUNK, {
          sessionId: session.id,
          messageId: `msg_asst_${Date.now()}`,
          finished: true,
        } as StreamChunkEvent);
      }
    }

    return session;
  }
}
