import { setRequestLocale, getTranslations } from "next-intl/server";
import { Translator } from "@/components/translator";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UsageIndicator } from "@/components/usage-indicator";
import type { LangCode } from "@/lib/languages";

export default async function HomePage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("header");
  const tFooter = await getTranslations("footer");

  const initialLang: LangCode = locale === "zh" ? "zh" : "en";

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header className="px-4 sm:px-8 py-3 flex items-center justify-between border-b border-neutral-200 bg-white">
        <div>
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-neutral-900">
            {t("brand")}
          </h1>
          <p className="text-xs text-neutral-500 hidden sm:block">
            {t("tagline")}
          </p>
        </div>
        <LocaleSwitcher />
      </header>

      <main className="flex-1 px-3 sm:px-6 py-4">
        <Translator initialLang={initialLang} />
      </main>

      <footer className="px-4 py-2 flex flex-col items-center gap-1 text-[10px] text-neutral-500 border-t border-neutral-200 bg-white">
        <UsageIndicator />
        <span>{tFooter("poweredBy")}</span>
      </footer>
    </div>
  );
}
