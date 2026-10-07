// The realtime link to the server (server/index.js, /ws). Reconnects on its own with
// a growing delay; without a server (plain `npm run dev`) it just stays offline.
//   const net = new NetClient(url); net.on('welcome' | 'join' | … , fn); net.connect(hello)
//   net.send(msg)   dropped while offline
//   net.online      true once the server greeted us
export class NetClient {
  constructor(url) { this.url = url; this.handlers = {}; this.ws = null; this.online = false; this.retry = 1; this.closed = false; }
  on(type, fn) { (this.handlers[type] ??= []).push(fn); return this; }
  emit(type, msg) { for (const fn of this.handlers[type] ?? []) fn(msg); }
  connect(hello) {
    this.hello = hello;
    if (this.closed) return;
    let ws;
    try { ws = this.ws = new WebSocket(this.url); } catch { this.later(); return; }
    ws.onopen = () => { this.retry = 1; ws.send(JSON.stringify({ t: 'hello', ...this.hello() })); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') { this.online = true; this.emit('status', true); }
      this.emit(m.t, m);
    };
    ws.onclose = () => { const was = this.online; this.online = false; this.ws = null; if (was) this.emit('status', false); this.later(); };
    ws.onerror = () => { /* onclose follows */ };
  }
  later() { if (this.closed) return; setTimeout(() => this.connect(this.hello), Math.min(30, this.retry) * 1000); this.retry *= 2; }
  send(msg) { if (this.online && this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  close() { this.closed = true; this.ws?.close(); }
}

// ws(s)://<this host>/ws — the page and the realtime link come from the same server.
export const serverUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
