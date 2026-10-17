import { CLOSE_LEAVE, CODE_LENGTH, CODE_LETTERS, type ClientMsg, type ServerMsg } from './protocol';

// WebSocket connection to the relay. The relay lives on the same host as the
// page (Vite dev server or the Cloudflare Worker) unless VITE_RELAY_URL points
// elsewhere, e.g. VITE_RELAY_URL=wss://spaceblast.example.workers.dev

function relayBase(): string {
  const env = import.meta.env.VITE_RELAY_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
}

export function randomCode(): string {
  // Math.random is fine here: room codes are not part of the sim.
  return Array.from({ length: CODE_LENGTH }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
}

export class NetClient {
  onMessage: (msg: ServerMsg) => void = () => {};
  /** The connection dropped (not called after close()), with the close code. */
  onDrop: (code: number) => void = () => {};
  private ws: WebSocket | null = null;

  /** Opens the room; resolves on the first server message (welcome or error). */
  /** `rejoin`: the seat and token from an earlier welcome, to get back into a dropped seat. */
  connect(code: string, create: boolean, name = '', color = -1, rejoin?: { slot: number; token: string }): Promise<ServerMsg> {
    this.close();
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        const q = new URLSearchParams({ name, color: String(color) });
        if (rejoin) {
          q.set('rejoin', String(rejoin.slot));
          q.set('token', rejoin.token);
        }
        if (create) q.set('create', '1');
        ws = new WebSocket(`${relayBase()}/room/${code}?${q}`);
      } catch (e) {
        reject(e);
        return;
      }
      this.ws = ws;
      let first = true;
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as ServerMsg;
        if (first) {
          first = false;
          resolve(msg);
        }
        this.onMessage(msg);
      };
      ws.onerror = () => first && reject(new Error('Could not reach the room server'));
      ws.onclose = (e) => {
        if (first) reject(new Error('Could not reach the room server'));
        else if (this.ws === ws) this.onDrop(e.code);
        if (this.ws === ws) this.ws = null;
      };
    });
  }

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(msg: ClientMsg): void {
    if (this.open) this.ws!.send(JSON.stringify(msg));
  }

  /** Closes the connection. CLOSE_LEAVE frees the seat; another code keeps it for a rejoin. */
  close(code = CLOSE_LEAVE): void {
    const ws = this.ws;
    this.ws = null;
    ws?.close(code);
  }
}
