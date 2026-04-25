"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";

type Usage = {
  deepgram:
    | { scope: "ok"; balance_usd?: number }
    | { scope: "missing" }
    | { scope: "no_key" };
  openrouter:
    | { ok: true; total_credits: number; total_usage: number }
    | { ok: false };
};

export function UsageIndicator() {
  const t = useTranslations("usage");
  const [data, setData] = useState<Usage | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) return;
        const json = (await res.json()) as Usage;
        if (alive) setData(json);
      } catch {}
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!data) return null;

  const dg = data.deepgram;
  const or = data.openrouter;

  const parts: string[] = [];
  if (dg.scope === "ok" && typeof dg.balance_usd === "number") {
    parts.push(`STT $${dg.balance_usd.toFixed(2)} ${t("remaining")}`);
  }
  if (or.ok) {
    parts.push(
      or.total_credits > 0
        ? `LLM $${(or.total_credits - or.total_usage).toFixed(2)} ${t("remaining")}`
        : `LLM $${or.total_usage.toFixed(2)} ${t("usedFreeTier")}`,
    );
  }
  if (parts.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500">
      <Wallet size={11} className="text-neutral-400" />
      <span className="text-neutral-600">{parts.join(" · ")}</span>
    </div>
  );
}
