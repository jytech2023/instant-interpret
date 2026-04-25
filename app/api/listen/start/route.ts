export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Session state lives entirely in the SSE handler; /start is a no-op
// kept so the existing client flow doesn't need to change.
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
  return Response.json({ ok: true });
}
