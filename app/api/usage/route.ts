export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DGUsageScope = "ok" | "missing" | "no_key";
type DGUsage = {
  scope: DGUsageScope;
  hours?: number;
  amount_usd?: number;
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

    // Last 30 days usage
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 30 * 86400_000)
      .toISOString()
      .slice(0, 10);
    const usageRes = await fetch(
      `https://api.deepgram.com/v1/projects/${pid}/usage?start=${start}&end=${end}`,
      {
        headers: { Authorization: `Token ${key}` },
        cache: "no-store",
      },
    );
    if (!usageRes.ok) return { scope: "missing" };
    const usage = (await usageRes.json()) as {
      results?: { hours?: number; amount?: number };
    };
    return {
      scope: "ok",
      hours: usage.results?.hours,
      amount_usd: usage.results?.amount,
    };
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
