"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  lang: string;
  onFinal: (text: string) => void;
};

export function useSpeechRecognition({ lang, onFinal }: Options) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onFinalRef = useRef(onFinal);
  const langRef = useRef(lang);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    langRef.current = lang;
    if (recognitionRef.current) recognitionRef.current.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = langRef.current;

    rec.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const finalText = transcript.trim();
          if (finalText) onFinalRef.current(finalText);
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(event.error || "speech_error");
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.lang = langRef.current;
      rec.start();
      setListening(true);
      setError(null);
    } catch {}
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {}
  }, []);

  return { supported, listening, interim, error, start, stop };
}
