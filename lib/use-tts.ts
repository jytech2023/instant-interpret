"use client";

import { useCallback, useEffect, useState } from "react";

export function useTTS() {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
  }, []);

  const speak = useCallback((text: string, lang: string) => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    if (!text) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1.0;
    utter.pitch = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { supported, speak, cancel };
}
