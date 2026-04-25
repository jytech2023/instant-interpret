import "server-only";
import { DeepgramClient } from "@deepgram/sdk";
import { createClient, type RedisClientType } from "redis";

type V1Socket = Awaited<ReturnType<DeepgramClient["listen"]["v1"]["connect"]>>;

const audioChannel = (id: string) => `dg:audio:${id}`;
const endChannel = (id: string) => `dg:end:${id}`;

type Globals = {
  __dgRedisPub?: RedisClientType;
};
const g = globalThis as unknown as Globals;

async function getPublisher(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (g.__dgRedisPub && g.__dgRedisPub.isOpen) return g.__dgRedisPub;
  const client: RedisClientType = createClient({ url });
  client.on("error", (err) => console.error("redis pub error", err));
  await client.connect();
  g.__dgRedisPub = client;
  return client;
}

export async function publishAudio(
  id: string,
  buf: ArrayBuffer,
): Promise<boolean> {
  const pub = await getPublisher();
  if (!pub) return false;
  await pub.publish(audioChannel(id), Buffer.from(buf) as unknown as string);
  return true;
}

export async function publishEnd(id: string): Promise<boolean> {
  const pub = await getPublisher();
  if (!pub) return false;
  await pub.publish(endChannel(id), "1");
  return true;
}

export type SsePipe = {
  enqueue: (chunk: string) => void;
  close: () => void;
  setOnClientAbort: (cb: () => void) => void;
};

export async function runTranscriptionSession(
  id: string,
  pipe: SsePipe,
): Promise<void> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const redisUrl = process.env.REDIS_URL;
  if (!apiKey) {
    pipe.enqueue(
      `event: error\ndata: ${JSON.stringify({ message: "no_dg_key" })}\n\n`,
    );
    pipe.close();
    return;
  }
  if (!redisUrl) {
    pipe.enqueue(
      `event: error\ndata: ${JSON.stringify({ message: "no_redis" })}\n\n`,
    );
    pipe.close();
    return;
  }

  const dg = new DeepgramClient({ apiKey });
  const socket: V1Socket = await dg.listen.v1.connect({
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

  // Dedicated subscriber connection (Redis pub/sub requires its own connection)
  const sub: RedisClientType = createClient({ url: redisUrl });
  sub.on("error", (err) => console.error("redis sub error", err));

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      socket.close();
    } catch {}
    try {
      await sub.unsubscribe();
    } catch {}
    try {
      await sub.disconnect();
    } catch {}
    pipe.close();
  };

  socket.on("message", (data) => {
    pipe.enqueue(`data: ${JSON.stringify(data)}\n\n`);
  });
  socket.on("error", (err) => {
    pipe.enqueue(
      `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`,
    );
  });
  socket.on("close", () => {
    cleanup();
  });

  socket.connect();
  try {
    await socket.waitForOpen();
  } catch {
    pipe.enqueue(
      `event: error\ndata: ${JSON.stringify({ message: "deepgram_open_failed" })}\n\n`,
    );
    await cleanup();
    return;
  }

  await sub.connect();
  // Subscribe in binary mode so we get Buffer, not utf-8 string (audio is binary)
  await sub.subscribe(
    audioChannel(id),
    (message: Buffer | string) => {
      const buf =
        typeof message === "string" ? Buffer.from(message, "binary") : message;
      try {
        socket.sendMedia(buf);
      } catch {}
    },
    true,
  );
  await sub.subscribe(endChannel(id), () => {
    cleanup();
  });

  pipe.enqueue(`event: ready\ndata: {}\n\n`);
  pipe.setOnClientAbort(cleanup);
}
