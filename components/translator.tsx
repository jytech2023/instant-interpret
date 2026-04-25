"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Mic, Square, Volume2, VolumeX, Trash2 } from "lucide-react";
import type { LangCode } from "@/lib/languages";
import { LANGUAGE_BY_CODE } from "@/lib/languages";
import { LanguagePicker } from "@/components/language-picker";
import { useDeepgramLive, type Utterance } from "@/lib/use-deepgram-live";
import { useTTS } from "@/lib/use-tts";
import { cn } from "@/lib/cn";

type Entry = {
  id: string;
  speaker: number;
  detectedLang?: string;
  original: string;
  translation?: string;
};

const SPEAKER_COLORS = [
  "border-sky-500 bg-sky-50",
  "border-amber-500 bg-amber-50",
  "border-emerald-500 bg-emerald-50",
  "border-fuchsia-500 bg-fuchsia-50",
  "border-rose-500 bg-rose-50",
  "border-cyan-500 bg-cyan-50",
];

const SPEAKER_DOT_COLORS = [
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-fuchsia-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function normalizeLang(detected: string | undefined): LangCode | null {
  if (!detected) return null;
  const lower = detected.toLowerCase();
  if (lower.startsWith("zh-tw") || lower.startsWith("zh-hant")) return "zh-TW";
  if (lower.startsWith("zh")) return "zh";
  const base = lower.split("-")[0];
  if (
    [
      "en",
      "ja",
      "ko",
      "fr",
      "de",
      "es",
      "ru",
      "ar",
      "pt",
      "it",
      "th",
      "vi",
      "hi",
    ].includes(base)
  ) {
    return base as LangCode;
  }
  return null;
}

export function Translator({ initialLang }: { initialLang: LangCode }) {
  const t = useTranslations();
  const [targetLang, setTargetLang] = useState<LangCode>(initialLang);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(false);
  const tts = useTTS();
  const feedRef = useRef<HTMLDivElement>(null);
  const targetLangRef = useRef(targetLang);
  const autoSpeakRef = useRef(autoSpeak);

  useEffect(() => {
    targetLangRef.current = targetLang;
  }, [targetLang]);

  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  useEffect(() => {
    const stored = localStorage.getItem("instant-interpret:autoSpeak");
    if (stored !== null) setAutoSpeak(stored === "1");
  }, []);

  useEffect(() => {
    localStorage.setItem("instant-interpret:autoSpeak", autoSpeak ? "1" : "0");
  }, [autoSpeak]);

  const translate = useCallback(
    async (text: string, from: LangCode, to: LangCode): Promise<string> => {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, from, to }),
      });
      if (!res.ok) throw new Error("translate failed");
      const data = (await res.json()) as { translation: string };
      return data.translation;
    },
    [],
  );

  const handleUtterance = useCallback(
    (u: Utterance) => {
      const detected = normalizeLang(u.language);
      const id = `${u.speaker}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const target = targetLangRef.current;
      const entry: Entry = {
        id,
        speaker: u.speaker,
        detectedLang: detected ?? undefined,
        original: u.text,
      };
      setEntries((p) => [...p, entry]);

      if (detected === target) return;
      const fromLang: LangCode = detected ?? "en";

      translate(u.text, fromLang, target)
        .then((translation) => {
          setEntries((p) =>
            p.map((e) => (e.id === id ? { ...e, translation } : e)),
          );
          if (autoSpeakRef.current) {
            tts.speak(translation, LANGUAGE_BY_CODE[target].bcp47);
          }
        })
        .catch(() => {
          setEntries((p) =>
            p.map((e) =>
              e.id === id
                ? { ...e, translation: `⚠ ${t("errors.translateFailed")}` }
                : e,
            ),
          );
        });
    },
    [translate, tts, t],
  );

  const live = useDeepgramLive({ onUtterance: handleUtterance });

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [entries.length, live.interim]);

  const isListening = live.status === "listening";
  const isConnecting = live.status === "connecting";

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)]">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-700 font-medium">
              {t("settings.translateTo")}
            </span>
            <LanguagePicker
              value={targetLang}
              onChange={setTargetLang}
              ariaLabel={t("settings.translateTo")}
            />
          </div>
          <p className="text-[11px] text-neutral-500">
            {t("settings.targetHint")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAutoSpeak((v) => !v)}
            aria-label={
              autoSpeak ? t("settings.ttsDisable") : t("settings.ttsEnable")
            }
            title={
              autoSpeak ? t("settings.ttsDisable") : t("settings.ttsEnable")
            }
            className={cn(
              "p-2 rounded-lg",
              autoSpeak
                ? "text-sky-600 hover:bg-sky-50"
                : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100",
            )}
          >
            {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setEntries([])}
            aria-label={t("panel.clear")}
            disabled={entries.length === 0}
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-30"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1"
      >
        {entries.length === 0 && !live.interim && (
          <div className="text-center text-neutral-500 text-sm pt-12 px-4">
            {live.status === "error" && live.error === "mic_denied"
              ? t("errors.micDenied")
              : t("panel.tapToSpeak")}
          </div>
        )}
        {entries.map((entry) => {
          const speakerColor =
            SPEAKER_COLORS[entry.speaker % SPEAKER_COLORS.length];
          const dotColor =
            SPEAKER_DOT_COLORS[entry.speaker % SPEAKER_DOT_COLORS.length];
          const isAlreadyTarget = entry.detectedLang === targetLang;
          return (
            <div
              key={entry.id}
              className={cn(
                "border-l-4 rounded-r-xl px-4 py-3 shadow-sm",
                speakerColor,
              )}
            >
              <div className="flex items-center gap-2 text-xs text-neutral-600 mb-2">
                <span
                  className={cn("w-2 h-2 rounded-full", dotColor)}
                  aria-hidden
                />
                <span className="font-medium text-neutral-700">
                  {t("panel.speaker")} {entry.speaker + 1}
                </span>
              </div>
              <div
                className={cn(
                  "grid gap-x-4 gap-y-3",
                  isAlreadyTarget
                    ? "grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-2",
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-neutral-500 font-semibold">
                    <span>{t("panel.original")}</span>
                    {entry.detectedLang && (
                      <span className="text-neutral-400">
                        · {entry.detectedLang}
                      </span>
                    )}
                  </div>
                  <p className="text-neutral-900 text-sm leading-relaxed">
                    {entry.original}
                  </p>
                </div>
                {!isAlreadyTarget && (
                  <div className="space-y-0.5 sm:border-l sm:border-neutral-200 sm:pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-neutral-500 font-semibold">
                        {t("panel.translation")} · {targetLang}
                      </span>
                      {entry.translation && tts.supported && (
                        <button
                          type="button"
                          onClick={() =>
                            tts.speak(
                              entry.translation!,
                              LANGUAGE_BY_CODE[targetLang].bcp47,
                            )
                          }
                          aria-label={t("panel.speak")}
                          className="text-neutral-500 hover:text-neutral-900"
                        >
                          <Volume2 size={12} />
                        </button>
                      )}
                    </div>
                    <p className="text-neutral-800 text-sm leading-relaxed">
                      {entry.translation ?? (
                        <span className="text-neutral-400 italic">
                          {t("panel.translating")}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {live.interim && (
          <div className="text-neutral-500 italic text-sm px-4 py-2">
            {live.interim}…
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 pt-2">
        <button
          type="button"
          onClick={isListening ? live.stop : live.start}
          disabled={isConnecting}
          className={cn(
            "relative flex items-center justify-center w-20 h-20 rounded-full transition-all shadow-lg",
            isListening
              ? "bg-red-600 hover:bg-red-700"
              : "bg-sky-600 hover:bg-sky-700",
            isConnecting && "opacity-60",
          )}
          aria-label={isListening ? t("panel.stop") : t("panel.start")}
        >
          {isListening ? (
            <>
              <span className="absolute w-20 h-20 rounded-full bg-red-500 animate-ping opacity-50" />
              <Square size={28} fill="white" className="text-white" />
            </>
          ) : (
            <Mic size={32} className="text-white" />
          )}
        </button>
        <p className="text-xs text-neutral-500 h-4">
          {isConnecting
            ? t("panel.connecting")
            : isListening
              ? t("panel.listening")
              : t("panel.tapToStart")}
        </p>
      </div>
    </div>
  );
}
