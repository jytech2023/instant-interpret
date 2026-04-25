import { attachController, deleteSession, getSession } from "@/lib/dg-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });
  if (!getSession(id)) return new Response("no_session", { status: 404 });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const ok = attachController(id, controller);
      if (!ok) {
        try {
          controller.close();
        } catch {}
        return;
      }
      req.signal.addEventListener("abort", () => {
        deleteSession(id);
      });
    },
    cancel() {
      deleteSession(id);
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
