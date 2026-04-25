import { runTranscriptionSession } from "@/lib/dg-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });

  const encoder = new TextEncoder();
  let abortHandler: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
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
      req.signal.addEventListener("abort", () => {
        if (abortHandler) abortHandler();
        safeClose();
      });
      await runTranscriptionSession(id, {
        enqueue: safeEnqueue,
        close: safeClose,
        setOnClientAbort: (cb) => {
          abortHandler = cb;
        },
      });
    },
    cancel() {
      if (abortHandler) abortHandler();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
