import { OmniModel, TokenUsage, ToolCall } from '../shared/types';
import { AGENT_TOOLS } from './tools';

export interface ChatCompletionChunkChoice {
  index: number;
  delta: {
    role?: string;
    content?: string | null;
    reasoning_content?: string | null;
    tool_calls?: Array<{
      index: number;
      id?: string;
      type?: string;
      function?: {
        name?: string;
        arguments?: string;
      };
    }>;
  };
  finish_reason?: string | null;
}

export interface StreamChatResult {
  content: string;
  reasoningContent: string;
  toolCalls: ToolCall[];
  tokenUsage?: TokenUsage;
  finishReason?: string;
}

export class OmniRouterClient {
  private normalizeBaseUrl(url: string): string {
    let clean = url.trim().replace(/\/+$/, '');
    if (!clean.endsWith('/v1') && !clean.includes('/v1/')) {
      clean = `${clean}/v1`;
    }
    return clean;
  }

  async fetchModels(baseUrl: string, apiKey: string): Promise<OmniModel[]> {
    const root = this.normalizeBaseUrl(baseUrl);
    const targetUrl = `${root}/models`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to fetch models from OmniRouter (${response.status}): ${errText || response.statusText}`);
    }

    const json = (await response.json()) as any;
    const rawList = Array.isArray(json) ? json : json?.data || [];

    const models: OmniModel[] = rawList.map((m: any) => ({
      id: typeof m === 'string' ? m : m.id,
      object: m.object,
      created: m.created,
      owned_by: m.owned_by,
      context_length: m.context_length,
    }));

    // Prioritize popular coding models
    return models.sort((a, b) => {
      const aIsTop = a.id.includes('claude') || a.id.includes('gpt-4') || a.id.includes('deepseek') || a.id.includes('codex');
      const bIsTop = b.id.includes('claude') || b.id.includes('gpt-4') || b.id.includes('deepseek') || b.id.includes('codex');
      if (aIsTop && !bIsTop) return -1;
      if (!aIsTop && bIsTop) return 1;
      return a.id.localeCompare(b.id);
    });
  }

  async testConnection(baseUrl: string, apiKey: string): Promise<{ success: boolean; message: string; modelCount?: number }> {
    try {
      const models = await this.fetchModels(baseUrl, apiKey);
      return {
        success: true,
        message: `Successfully connected to OmniRouter! Retrieved ${models.length} models.`,
        modelCount: models.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Unknown connection error',
      };
    }
  }

  async streamChat(
    baseUrl: string,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string; name?: string; tool_call_id?: string; tool_calls?: any[] }>,
    options: {
      temperature?: number;
      maxTokens?: number;
      abortSignal?: AbortSignal;
      onDeltaText?: (delta: string) => void;
      onDeltaReasoning?: (delta: string) => void;
      onDeltaToolCall?: (index: number, id?: string, name?: string, argsChunk?: string) => void;
    }
  ): Promise<StreamChatResult> {
    const root = this.normalizeBaseUrl(baseUrl);
    const targetUrl = `${root}/chat/completions`;

    const payload = {
      model,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      stream: true,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 4096,
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OmniRouter request failed (${response.status}): ${errText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('OmniRouter response body is null');
    }

    let fullContent = '';
    let fullReasoning = '';
    let inThinkTag = false;
    let pendingContentBuffer = '';
    let finishReason = '';
    let tokenUsage: TokenUsage | undefined;

    // Map tool_call index -> accumulated data
    const accumulatedTools = new Map<number, { id: string; name: string; args: string }>();

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // SSE comments / keep-alives

          if (trimmed === 'data: [DONE]') {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);

              // Extract usage if available
              if (parsed.usage) {
                tokenUsage = {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0,
                };
              }

              const choice = parsed.choices?.[0] as ChatCompletionChunkChoice | undefined;
              if (!choice) continue;

              if (choice.finish_reason) {
                finishReason = choice.finish_reason;
              }

              // 1. Handle reasoning_content (DeepSeek / Qwen style)
              if (choice.delta.reasoning_content) {
                const chunk = choice.delta.reasoning_content;
                fullReasoning += chunk;
                options.onDeltaReasoning?.(chunk);
              }

                // 2. Handle content and inline <think> tags with chunked boundary protection
                if (choice.delta.content) {
                  pendingContentBuffer += choice.delta.content;

                  while (pendingContentBuffer.length > 0) {
                    if (!inThinkTag) {
                      const thinkIdx = pendingContentBuffer.indexOf('<think>');
                      if (thinkIdx !== -1) {
                        const before = pendingContentBuffer.substring(0, thinkIdx);
                        if (before) {
                          fullContent += before;
                          options.onDeltaText?.(before);
                        }
                        inThinkTag = true;
                        pendingContentBuffer = pendingContentBuffer.substring(thinkIdx + 7);
                        continue;
                      }

                      // Check if buffer ends with a potential prefix of '<think>'
                      let matchedPrefixLen = 0;
                      const checkLen = Math.min(6, pendingContentBuffer.length);
                      for (let len = checkLen; len >= 1; len--) {
                        const candidate = pendingContentBuffer.slice(-len);
                        if ('<think>'.startsWith(candidate)) {
                          matchedPrefixLen = len;
                          break;
                        }
                      }

                      if (matchedPrefixLen > 0) {
                        const emitText = pendingContentBuffer.slice(0, -matchedPrefixLen);
                        if (emitText) {
                          fullContent += emitText;
                          options.onDeltaText?.(emitText);
                        }
                        pendingContentBuffer = pendingContentBuffer.slice(-matchedPrefixLen);
                        break;
                      } else {
                        fullContent += pendingContentBuffer;
                        options.onDeltaText?.(pendingContentBuffer);
                        pendingContentBuffer = '';
                      }
                    } else {
                      const endThinkIdx = pendingContentBuffer.indexOf('</think>');
                      if (endThinkIdx !== -1) {
                        const before = pendingContentBuffer.substring(0, endThinkIdx);
                        if (before) {
                          fullReasoning += before;
                          options.onDeltaReasoning?.(before);
                        }
                        inThinkTag = false;
                        pendingContentBuffer = pendingContentBuffer.substring(endThinkIdx + 8);
                        continue;
                      }

                      // Check if buffer ends with a potential prefix of '</think>'
                      let matchedPrefixLen = 0;
                      const checkLen = Math.min(7, pendingContentBuffer.length);
                      for (let len = checkLen; len >= 1; len--) {
                        const candidate = pendingContentBuffer.slice(-len);
                        if ('</think>'.startsWith(candidate)) {
                          matchedPrefixLen = len;
                          break;
                        }
                      }

                      if (matchedPrefixLen > 0) {
                        const emitReasoning = pendingContentBuffer.slice(0, -matchedPrefixLen);
                        if (emitReasoning) {
                          fullReasoning += emitReasoning;
                          options.onDeltaReasoning?.(emitReasoning);
                        }
                        pendingContentBuffer = pendingContentBuffer.slice(-matchedPrefixLen);
                        break;
                      } else {
                        fullReasoning += pendingContentBuffer;
                        options.onDeltaReasoning?.(pendingContentBuffer);
                        pendingContentBuffer = '';
                      }
                    }
                  }
                }

                // 3. Handle tool calls
                if (choice.delta.tool_calls) {
                  for (const tc of choice.delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    const current = accumulatedTools.get(idx) || { id: '', name: '', args: '' };

                    if (tc.id) current.id = tc.id;
                    if (tc.function?.name) {
                      if (!current.name) {
                        current.name = tc.function.name;
                      } else if (!current.name.endsWith(tc.function.name) && current.name !== tc.function.name) {
                        current.name += tc.function.name;
                      }
                    }
                    if (tc.function?.arguments) current.args += tc.function.arguments;

                    accumulatedTools.set(idx, current);
                    options.onDeltaToolCall?.(idx, tc.id, tc.function?.name, tc.function?.arguments);
                  }
                }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (pendingContentBuffer) {
      if (inThinkTag) {
        fullReasoning += pendingContentBuffer;
        options.onDeltaReasoning?.(pendingContentBuffer);
      } else {
        fullContent += pendingContentBuffer;
        options.onDeltaText?.(pendingContentBuffer);
      }
      pendingContentBuffer = '';
    }

    const finalToolCalls: ToolCall[] = [];
    for (const [, tool] of accumulatedTools) {
      let parsedArgs: Record<string, any> = {};
      try {
        parsedArgs = JSON.parse(tool.args || '{}');
      } catch {
        parsedArgs = { raw: tool.args };
      }

      finalToolCalls.push({
        id: tool.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: tool.name,
        arguments: parsedArgs,
        rawArguments: tool.args,
        status: 'running',
        timestamp: Date.now(),
      });
    }

    return {
      content: fullContent,
      reasoningContent: fullReasoning,
      toolCalls: finalToolCalls,
      tokenUsage,
      finishReason,
    };
  }
}

export const omniRouterClient = new OmniRouterClient();
