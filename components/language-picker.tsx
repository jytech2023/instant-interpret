"use client";

import { useTranslations } from "next-intl";
import { LANGUAGES, type LangCode } from "@/lib/languages";

export function LanguagePicker({
  value,
  onChange,
  ariaLabel,
}: {
  value: LangCode;
  onChange: (next: LangCode) => void;
  ariaLabel: string;
}) {
  const t = useTranslations("languages");
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as LangCode)}
      className="bg-white text-neutral-900 border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {t(l.code)}
        </option>
      ))}
    </select>
  );
}
