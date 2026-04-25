"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Languages } from "lucide-react";

export function LocaleSwitcher() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const next = locale === "en" ? "zh" : "en";

  return (
    <button
      type="button"
      onClick={() =>
        router.replace(pathname, { locale: next as (typeof routing.locales)[number] })
      }
      className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900"
    >
      <Languages size={14} />
      {t("switchLang")}
    </button>
  );
}
