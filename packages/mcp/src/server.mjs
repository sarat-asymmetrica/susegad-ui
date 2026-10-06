// The MCP protocol layer: newline-delimited JSON-RPC 2.0 over stdio, as the
// MCP spec defines the stdio transport. No dependency: the messages the
// server answers are initialize, ping, tools/list and tools/call, plus the
// initialized notification, and that is the whole of it for a tools-only
// server. The framing is well tested by mcp.test.js, which drives this file
// through a real child process.

const PROTOCOL_VERSION = '2025-06-18';

/**
 * Build the handler for one set of tools. Kept separate from the stdio loop
 * so tests can drive handleMessage directly.
 * @param {{ name: string, version: string, instructions: string, tools: Array<{name, description, inputSchema, run}> }} info
 */
export function createHandler({ name, version, instructions, tools }) {
  const byName = new Map(tools.map(t => [t.name, t]));

  async function handleMessage(msg) {
    if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') {
      return err(null, -32600, 'Not a JSON-RPC 2.0 message.');
    }
    const isNotification = msg.id === undefined;
    const { method } = msg;
    try {
      if (method === 'initialize') {
        return ok(msg, {
          protocolVersion: msg.params?.protocolVersion ?? PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name, version },
          instructions,
        });
      }
      if (method === 'ping') return ok(msg, {});
      if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
        return isNotification ? null : err(msg.id, -32601, `The server does not answer ${method}: notifications expect no reply.`);
      }
      if (method === 'tools/list') {
        return ok(msg, {
          tools: tools.map(({ name: n, description, inputSchema }) => ({ name: n, description, inputSchema })),
        });
      }
      if (method === 'tools/call') {
        const toolName = msg.params?.name;
        const tool = byName.get(toolName);
        if (!tool) return ok(msg, { content: [{ type: 'text', text: `I do not have a tool called "${toolName}". I have: ${[...byName.keys()].join(', ')}.` }], isError: true });
        const result = await tool.run(msg.params?.arguments ?? {});
        if (result?.error !== undefined) {
          // An honest failure inside a tool: text the harness can read, not a crash.
          return ok(msg, { content: [{ type: 'text', text: result.error }], isError: true, structuredContent: result });
        }
        return ok(msg, {
          content: [{ type: 'text', text: renderResult(result) }],
          structuredContent: result,
        });
      }
      return isNotification ? null : err(msg.id, -32601, `I do not know the method ${method}.`);
    } catch (e) {
      return err(msg.id ?? null, -32603, e.message ?? String(e));
    }
  }
  return handleMessage;
}

function ok(msg, result) { return { jsonrpc: '2.0', id: msg.id, result }; }
function err(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }

/** A result becomes text the calling harness can show a person. */
function renderResult(result) {
  if (typeof result?.output === 'string') return result.output || (result.code ? '' : 'Done.');
  return JSON.stringify(result, null, 2);
}

/**
 * Serve over stdio: one JSON message per line on stdin, answers on stdout.
 * Resolves when stdin closes.
 */
export async function serveStdio(info, { input = process.stdin, output = process.stdout } = {}) {
  const handleMessage = createHandler(info);
  const write = msg => { if (msg) output.write(JSON.stringify(msg) + '\n'); };
  let buffer = '';
  for await (const chunk of input) {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, '');
      buffer = buffer.slice(index + 1);
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); }
      catch { write(err(null, -32700, 'That line was not valid JSON.')); continue; }
      write(await handleMessage(msg));
    }
  }
}
