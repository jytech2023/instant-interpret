import { deleteSession } from "@/lib/dg-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });
  deleteSession(id);
  return new Response(null, { status: 204 });
}
