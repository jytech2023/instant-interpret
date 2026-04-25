"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";

type Usage = {
  deepgram:
    | { scope: "ok"; hours?: number; amount_usd?: number }
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

  let dgText: string;
  if (dg.scope === "no_key") dgText = t("noKey");
  else if (dg.scope === "missing") dgText = t("scopeMissing");
  else if (typeof dg.amount_usd === "number")
    dgText = `$${dg.amount_usd.toFixed(2)} ${t("used30d")}`;
  else if (typeof dg.hours === "number")
    dgText = `${dg.hours.toFixed(2)} h ${t("used30d")}`;
  else dgText = t("ok");

  const orText = or.ok
    ? or.total_credits > 0
      ? `$${(or.total_credits - or.total_usage).toFixed(2)} ${t("remaining")}`
      : `$${or.total_usage.toFixed(2)} ${t("usedFreeTier")}`
    : t("noKey");

  return (
    <div className="flex items-center justify-center gap-3 text-[10px] text-neutral-500">
      <Wallet size={11} className="text-neutral-400" />
      <span>
        <span className="text-neutral-400">Deepgram</span>{" "}
        <span className="text-neutral-600">{dgText}</span>
      </span>
      <span className="text-neutral-300">·</span>
      <span>
        <span className="text-neutral-400">OpenRouter</span>{" "}
        <span className="text-neutral-600">{orText}</span>
      </span>
    </div>
  );
}
