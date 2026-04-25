export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DGUsageScope = "ok" | "missing" | "no_key";
type DGUsage = {
  scope: DGUsageScope;
  balance_usd?: number;
};

type ORCredits =
  | { ok: true; total_credits: number; total_usage: number }
  | { ok: false };

async function deepgramUsage(): Promise<DGUsage> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return { scope: "no_key" };
  try {
    const projRes = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${key}` },
      cache: "no-store",
    });
    if (!projRes.ok) return { scope: "missing" };
    const projData = (await projRes.json()) as {
      projects?: Array<{ project_id: string }>;
    };
    const pid = projData.projects?.[0]?.project_id;
    if (!pid) return { scope: "missing" };

    const balRes = await fetch(
      `https://api.deepgram.com/v1/projects/${pid}/balances`,
      {
        headers: { Authorization: `Token ${key}` },
        cache: "no-store",
      },
    );
    if (!balRes.ok) return { scope: "missing" };
    const data = (await balRes.json()) as {
      balances?: Array<{ amount?: number; units?: string }>;
    };
    const totalUsd =
      data.balances
        ?.filter((b) => (b.units ?? "").toLowerCase() === "usd")
        .reduce((sum, b) => sum + (b.amount ?? 0), 0) ?? 0;
    return { scope: "ok", balance_usd: totalUsd };
  } catch {
    return { scope: "missing" };
  }
}

async function openrouterCredits(): Promise<ORCredits> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false };
  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as {
      data?: { total_credits: number; total_usage: number };
    };
    if (!json.data) return { ok: false };
    return {
      ok: true,
      total_credits: json.data.total_credits,
      total_usage: json.data.total_usage,
    };
  } catch {
    return { ok: false };
  }
}

export async function GET() {
  const [deepgram, openrouter] = await Promise.all([
    deepgramUsage(),
    openrouterCredits(),
  ]);
  return Response.json(
    { deepgram, openrouter },
    { headers: { "cache-control": "no-store" } },
  );
}
