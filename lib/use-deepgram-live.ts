"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Utterance = {
  speaker: number;
  text: string;
  language?: string;
};

type Options = {
  onUtterance: (u: Utterance) => void;
};

type Status = "idle" | "connecting" | "listening" | "error";

type DeepgramWord = {
  word?: string;
  speaker?: number;
  language?: string;
};

type DeepgramMessage = {
  type?: string;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      languages?: string[];
      words?: DeepgramWord[];
    }>;
  };
};

export function useDeepgramLive({ onUtterance }: Options) {
  const [status, setStatus] = useState<Status>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const onUtteranceRef = useRef(onUtterance);
  useEffect(() => {
    onUtteranceRef.current = onUtterance;
  }, [onUtterance]);

  const stop = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {}
    recorderRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    const sid = sessionIdRef.current;
    if (sid) {
      fetch(`/api/listen/end?id=${sid}`, { method: "POST", keepalive: true }).catch(
        () => {},
      );
      sessionIdRef.current = null;
    }
    setInterim("");
    setStatus("idle");
  }, []);

  const handleMessage = useCallback((data: DeepgramMessage) => {
    if (data.type !== "Results") return;
    const alt = data.channel?.alternatives?.[0];
    const transcript = alt?.transcript?.trim();
    if (!transcript) {
      if (data.is_final) setInterim("");
      return;
    }
    if (data.is_final) {
      const words = alt?.words ?? [];
      const speakerCounts = new Map<number, number>();
      const langCounts = new Map<string, number>();
      for (const w of words) {
        if (typeof w.speaker === "number") {
          speakerCounts.set(w.speaker, (speakerCounts.get(w.speaker) ?? 0) + 1);
        }
        if (w.language) {
          langCounts.set(w.language, (langCounts.get(w.language) ?? 0) + 1);
        }
      }
      const speaker =
        [...speakerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
      const language =
        [...langCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        alt?.languages?.[0];
      setInterim("");
      onUtteranceRef.current({ speaker, text: transcript, language });
    } else {
      setInterim(transcript);
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    try {
      // 1. mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // 2. session
      const sid =
        crypto.randomUUID?.() ??
        `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionIdRef.current = sid;

      const startRes = await fetch("/api/listen/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: sid }),
      });
      if (!startRes.ok) {
        throw new Error(`session_start_${startRes.status}`);
      }

      // 3. SSE downstream
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`/api/listen/events?id=${sid}`);
        eventSourceRef.current = es;
        let opened = false;
        es.addEventListener("ready", () => {
          opened = true;
          resolve();
        });
        es.onmessage = (e) => {
          try {
            handleMessage(JSON.parse(e.data) as DeepgramMessage);
          } catch {}
        };
        es.addEventListener("error", () => {
          if (!opened) reject(new Error("sse_open_failed"));
        });
        // failsafe: resolve after 1.5s if ready event missed
        setTimeout(() => {
          if (!opened) {
            opened = true;
            resolve();
          }
        }, 1500);
      });

      // 4. recorder → POST audio chunks
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        if (sessionIdRef.current !== sid) return;
        fetch(`/api/listen/audio?id=${sid}`, {
          method: "POST",
          body: e.data,
          headers: { "content-type": "application/octet-stream" },
        }).catch(() => {});
      };
      recorder.start(250);

      setStatus("listening");
    } catch (err) {
      console.error("start failed", err);
      const msg = (err as Error).message ?? "start_failed";
      const lower = msg.toLowerCase();
      setError(
        lower.includes("permission") || lower.includes("denied")
          ? "mic_denied"
          : msg,
      );
      setStatus("error");
      stop();
    }
  }, [handleMessage, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { status, interim, error, start, stop };
}
