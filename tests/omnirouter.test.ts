import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { omniRouterClient } from '../src/main/omnirouter';
import { AGENT_TOOLS } from '../src/main/tools';

test('OmniRouter Client & Tools Definition Test Suite', async (t) => {
  await t.test('AGENT_TOOLS includes all mandatory tools', () => {
    const toolNames = AGENT_TOOLS.map((t) => t.function.name);
    assert.ok(toolNames.includes('list_directory'));
    assert.ok(toolNames.includes('read_file'));
    assert.ok(toolNames.includes('write_file'));
    assert.ok(toolNames.includes('apply_diff'));
    assert.ok(toolNames.includes('search_files'));
    assert.ok(toolNames.includes('execute_command'));
  });

  await t.test('All AGENT_TOOLS have valid JSON schemas', () => {
    for (const tool of AGENT_TOOLS) {
      assert.strictEqual(tool.type, 'function');
      assert.ok(tool.function.name.length > 0);
      assert.ok(tool.function.description.length > 0);
      assert.strictEqual(tool.function.parameters.type, 'object');
      assert.ok(typeof tool.function.parameters.properties === 'object');
      assert.ok(Array.isArray(tool.function.parameters.required));
    }
  });

  await t.test('Client normalizes base URL correctly', () => {
    const client = omniRouterClient as any;
    assert.strictEqual(
      client.normalizeBaseUrl('https://api.omnirouter.ai'),
      'https://api.omnirouter.ai/v1'
    );
    assert.strictEqual(
      client.normalizeBaseUrl('https://api.omnirouter.ai/'),
      'https://api.omnirouter.ai/v1'
    );
    assert.strictEqual(
      client.normalizeBaseUrl('https://api.omnirouter.ai/v1'),
      'https://api.omnirouter.ai/v1'
    );
    assert.strictEqual(
      client.normalizeBaseUrl('http://localhost:8000/v1/'),
      'http://localhost:8000/v1'
    );
  });

  await t.test('streamChat correctly parses reasoning split across chunk boundaries', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const chunks = [
        'data: {"choices":[{"delta":{"content":"<th"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"ink>planning my steps</th"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"ink>Here is the solution."}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      for (const c of chunks) {
        res.write(c);
      }
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as any;
    const testUrl = `http://127.0.0.1:${address.port}`;

    let streamedReasoning = '';
    let streamedText = '';

    const result = await omniRouterClient.streamChat(
      testUrl,
      'fake-key',
      'test-model',
      [{ role: 'user', content: 'test' }],
      {
        onDeltaReasoning: (d) => {
          streamedReasoning += d;
        },
        onDeltaText: (d) => {
          streamedText += d;
        },
      }
    );

    server.close();

    assert.strictEqual(result.reasoningContent, 'planning my steps');
    assert.strictEqual(result.content, 'Here is the solution.');
    assert.strictEqual(streamedReasoning, 'planning my steps');
    assert.strictEqual(streamedText, 'Here is the solution.');
  });

  await t.test('streamChat correctly accumulates tool call chunks and arguments', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
      });

      const chunks = [
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"read_file","arguments":"{\\"path\\":\\""}}]}}]}\n\n',
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"read_file","arguments":"src/index.ts\\"}"}}]}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      for (const c of chunks) {
        res.write(c);
      }
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as any;
    const testUrl = `http://127.0.0.1:${address.port}`;

    const result = await omniRouterClient.streamChat(
      testUrl,
      'fake-key',
      'test-model',
      [{ role: 'user', content: 'test' }],
      {}
    );

    server.close();

    assert.strictEqual(result.toolCalls.length, 1);
    assert.strictEqual(result.toolCalls[0].name, 'read_file');
    assert.deepStrictEqual(result.toolCalls[0].arguments, { path: 'src/index.ts' });
  });
});
