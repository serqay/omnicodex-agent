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
  sessionId: string;
  resolve: (value: { approved: boolean; feedback?: string }) => void;
}

export class AgentLoopManager {
  private activeControllers = new Map<string, AbortController>();
  private pendingApprovals = new Map<string, PendingApproval>();
  private sessionCommandIds = new Map<string, Set<string>>();

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

    // Reject ONLY pending tool approvals for THIS specific session
    for (const [id, pending] of this.pendingApprovals) {
      if (pending.sessionId === sessionId) {
        pending.resolve({ approved: false, feedback: 'Operation cancelled by user' });
        this.pendingApprovals.delete(id);
      }
    }

    // Terminate ONLY processes spawned by THIS specific session
    const cmds = this.sessionCommandIds.get(sessionId);
    if (cmds) {
      for (const cmdId of cmds) {
        processManager.kill(cmdId);
      }
      this.sessionCommandIds.delete(sessionId);
    }
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

    let sessionCmdSet = this.sessionCommandIds.get(session.id);
    if (!sessionCmdSet) {
      sessionCmdSet = new Set();
      this.sessionCommandIds.set(session.id, sessionCmdSet);
    }

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

    // 2. Add user message with embedded file context so history is never lost across turns
    const userContent = fileContextBlock ? `${userPrompt}${fileContextBlock}` : userPrompt;
    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: userContent,
      attachedFiles,
      timestamp: Date.now(),
    };
    session.messages.push(userMessage);
    session.updatedAt = Date.now();
    await this.storage.saveSession(session);

    const maxIterations = 25;
    let iteration = 0;
    let isLoopCompleted = false;
    let lastAssistantMsgId: string | null = null;

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
            apiMessages.push({
              role: 'user',
              content: msg.content,
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
        lastAssistantMsgId = assistantMsgId;
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
        session.updatedAt = Date.now();
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

          // Generate preview for diff or command safely with try/catch
          try {
            const previews = await generateToolPreview(workspacePath, tool.name, tool.arguments);
            tool.diffPreview = previews.diffPreview;
            tool.commandPreview = previews.commandPreview;
          } catch (err: any) {
            // Do not crash the loop if preview generation fails; report error back to model
            tool.status = 'error';
            tool.error = err.message || 'Failed to generate preview for tool';
            if (!webContents.isDestroyed()) {
              webContents.send(IPC_CHANNELS.EVENT_TOOL_CALL, {
                sessionId: session.id,
                messageId: assistantMsgId,
                tool,
              });
            }

            session.messages.push({
              id: `msg_tool_${Date.now()}_${tool.id}`,
              role: 'tool',
              toolCallId: tool.id,
              name: tool.name,
              content: JSON.stringify({ error: tool.error }),
              timestamp: Date.now(),
            });
            session.updatedAt = Date.now();
            await this.storage.saveSession(session);
            continue;
          }

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
              this.pendingApprovals.set(tool.id, { sessionId: session.id, resolve });
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
              session.updatedAt = Date.now();
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

          // Track active command for session-isolated cancellation
          sessionCmdSet.add(tool.id);

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
          } finally {
            sessionCmdSet.delete(tool.id);
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
          session.updatedAt = Date.now();
          await this.storage.saveSession(session);
        }

        // Check if loop reached iteration limit
        if (iteration >= maxIterations && !isLoopCompleted) {
          const limitNotice = '\n\n[Limit Notice: The agent reached the maximum iteration limit (25 steps) for this task.]';
          const limitMsgId = `msg_asst_limit_${Date.now()}`;
          session.messages.push({
            id: limitMsgId,
            role: 'assistant',
            content: limitNotice,
            timestamp: Date.now(),
          });
          session.updatedAt = Date.now();
          await this.storage.saveSession(session);

          if (!webContents.isDestroyed()) {
            webContents.send(IPC_CHANNELS.EVENT_STREAM_CHUNK, {
              sessionId: session.id,
              messageId: limitMsgId,
              deltaText: limitNotice,
              finished: true,
            } as StreamChunkEvent);
          }
          isLoopCompleted = true;
          break;
        }
      }
    } finally {
      this.activeControllers.delete(session.id);
      this.sessionCommandIds.delete(session.id);

      if (!isLoopCompleted && !webContents.isDestroyed()) {
        webContents.send(IPC_CHANNELS.EVENT_STREAM_CHUNK, {
          sessionId: session.id,
          messageId: lastAssistantMsgId || `msg_asst_${Date.now()}`,
          finished: true,
        } as StreamChunkEvent);
      }
    }

    return session;
  }
}
