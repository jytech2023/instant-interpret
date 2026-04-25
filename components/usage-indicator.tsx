"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";

type Usage = {
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

  if (!data || !data.openrouter.ok) return null;

  const or = data.openrouter;
  const text =
    or.total_credits > 0
      ? `$${(or.total_credits - or.total_usage).toFixed(2)} ${t("remaining")}`
      : `$${or.total_usage.toFixed(2)} ${t("usedFreeTier")}`;

  return (
    <div className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500">
      <Wallet size={11} className="text-neutral-400" />
      <span>
        <span className="text-neutral-400">{t("usage")}</span>{" "}
        <span className="text-neutral-600">{text}</span>
      </span>
    </div>
  );
}
