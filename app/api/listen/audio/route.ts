import { sendAudio } from "@/lib/dg-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });

  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) {
    return new Response(null, { status: 204 });
  }
  const ok = sendAudio(id, buf);
  return new Response(null, { status: ok ? 204 : 410 });
}
