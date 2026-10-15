#!/usr/bin/env node
// 一次性 MCP 工具调用器: node scripts/mcp-call.mjs <tool> '<json-args>'
// 握手 → tools/call → 打印结果 → 退出
import { spawn } from 'node:child_process';

const [tool, argsJson] = process.argv.slice(2);
if (!tool) {
  console.error('usage: mcp-call.mjs <tool> [json-args]');
  process.exit(1);
}
const args = argsJson ? JSON.parse(argsJson) : {};
const child = spawn(process.execPath, ['src/cli.js', 'mcp', '--client', 'claude-code'], {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: ['pipe', 'pipe', 'inherit'],
});

const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
let buf = '';
const pending = new Map();
child.stdout.on('data', (c) => {
  buf += c;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
const rpc = (method, params) => new Promise((res) => {
  const id = rpc.n = (rpc.n || 0) + 1;
  pending.set(id, res);
  send({ jsonrpc: '2.0', id, method, params });
});

await rpc('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'mcp-call', version: '0.1.0' },
});
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
const r = await rpc('tools/call', { name: tool, arguments: args });
const text = (r.result?.content ?? []).map((c) => c.text ?? '').join('\n');
console.log(text || JSON.stringify(r.result ?? r.error));
child.kill();
process.exit(0);
