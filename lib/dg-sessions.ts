import "server-only";
import { DeepgramClient } from "@deepgram/sdk";

type Controller = ReadableStreamDefaultController<Uint8Array>;
type V1Socket = Awaited<ReturnType<DeepgramClient["listen"]["v1"]["connect"]>>;

export type Session = {
  id: string;
  socket: V1Socket;
  controller: Controller | null;
  ready: boolean;
  closed: boolean;
  pendingMessages: string[];
  lastSeen: number;
};

type Globals = {
  __dgSessions?: Map<string, Session>;
  __dgGcStarted?: boolean;
};

const g = globalThis as unknown as Globals;
const sessions: Map<string, Session> = (g.__dgSessions ??= new Map());

const SESSION_TTL_MS = 5 * 60 * 1000;

if (!g.__dgGcStarted) {
  g.__dgGcStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, s] of sessions) {
      if (now - s.lastSeen > SESSION_TTL_MS) {
        try {
          s.socket.close();
        } catch {}
        try {
          s.controller?.close();
        } catch {}
        sessions.delete(id);
      }
    }
  }, 60_000).unref?.();
}

export function getSession(id: string): Session | undefined {
  const s = sessions.get(id);
  if (s) s.lastSeen = Date.now();
  return s;
}

export function deleteSession(id: string): void {
  const s = sessions.get(id);
  if (!s) return;
  s.closed = true;
  try {
    s.socket.close();
  } catch {}
  try {
    s.controller?.close();
  } catch {}
  sessions.delete(id);
}

const encoder = new TextEncoder();

function emit(session: Session, payload: string): void {
  if (session.closed) return;
  if (!session.controller) {
    session.pendingMessages.push(payload);
    return;
  }
  try {
    session.controller.enqueue(encoder.encode(payload));
  } catch {}
}

export async function createSession(id: string): Promise<Session> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY not set");

  const dg = new DeepgramClient({ apiKey });
  const socket = await dg.listen.v1.connect({
    Authorization: `Token ${apiKey}`,
    model: "nova-3",
    language: "multi",
    diarize: "true",
    smart_format: "true",
    punctuate: "true",
    interim_results: "true",
    endpointing: 300,
    utterance_end_ms: 1000,
    vad_events: "true",
  });

  const session: Session = {
    id,
    socket,
    controller: null,
    ready: false,
    closed: false,
    pendingMessages: [],
    lastSeen: Date.now(),
  };
  sessions.set(id, session);

  socket.on("message", (data) => {
    emit(session, `data: ${JSON.stringify(data)}\n\n`);
  });
  socket.on("error", (err) => {
    emit(
      session,
      `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`,
    );
  });
  socket.on("close", () => {
    deleteSession(id);
  });

  socket.connect();
  try {
    await socket.waitForOpen();
    session.ready = true;
    emit(session, `event: ready\ndata: {}\n\n`);
  } catch (err) {
    deleteSession(id);
    throw err;
  }
  return session;
}

export function attachController(id: string, controller: Controller): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  s.controller = controller;
  s.lastSeen = Date.now();
  for (const msg of s.pendingMessages) {
    try {
      controller.enqueue(encoder.encode(msg));
    } catch {}
  }
  s.pendingMessages = [];
  return true;
}

export function sendAudio(id: string, buf: ArrayBuffer): boolean {
  const s = sessions.get(id);
  if (!s || s.closed) return false;
  try {
    s.socket.sendMedia(buf);
    s.lastSeen = Date.now();
    return true;
  } catch {
    return false;
  }
}
