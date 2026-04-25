import { createSession } from "@/lib/dg-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let id: string;
  try {
    const body = (await req.json()) as { id?: string };
    id = body.id ?? "";
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!id || id.length < 8) {
    return Response.json({ error: "id_required" }, { status: 400 });
  }

  try {
    await createSession(id);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("createSession failed", err);
    return Response.json(
      { error: "deepgram_open_failed" },
      { status: 502 },
    );
  }
}
