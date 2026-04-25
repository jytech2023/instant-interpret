import { DeepgramClient } from "@deepgram/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return new Response("DEEPGRAM_API_KEY not set", { status: 500 });
  }
  if (!req.body) {
    return new Response("No request body", { status: 400 });
  }

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

  const encoder = new TextEncoder();
  const audioBody = req.body;

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {}
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      socket.on("message", (data) => {
        safeEnqueue(`data: ${JSON.stringify(data)}\n\n`);
      });
      socket.on("error", (err) => {
        safeEnqueue(
          `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`,
        );
      });
      socket.on("close", () => {
        safeClose();
      });

      socket.connect();
      try {
        await socket.waitForOpen();
        safeEnqueue(`event: ready\ndata: {}\n\n`);
      } catch {
        safeEnqueue(
          `event: error\ndata: ${JSON.stringify({ message: "deepgram_open_failed" })}\n\n`,
        );
        safeClose();
        return;
      }

      const reader = audioBody.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            socket.sendMedia(value);
          }
        }
      } catch {
        // client aborted
      } finally {
        try {
          socket.sendCloseStream({ type: "CloseStream" });
        } catch {}
        setTimeout(() => {
          try {
            socket.close();
          } catch {}
          safeClose();
        }, 1500);
      }
    },
    cancel() {
      try {
        socket.close();
      } catch {}
    },
  });

  return new Response(responseStream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
