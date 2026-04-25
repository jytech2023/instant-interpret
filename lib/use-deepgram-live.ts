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
  const abortRef = useRef<AbortController | null>(null);
  const audioControllerRef =
    useRef<ReadableStreamDefaultController<Uint8Array> | null>(null);

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

    try {
      audioControllerRef.current?.close();
    } catch {}
    audioControllerRef.current = null;

    abortRef.current?.abort();
    abortRef.current = null;

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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const audioStream = new ReadableStream<Uint8Array>({
        start(controller) {
          audioControllerRef.current = controller;
        },
      });

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = async (e) => {
        if (e.data.size === 0) return;
        try {
          const buf = await e.data.arrayBuffer();
          audioControllerRef.current?.enqueue(new Uint8Array(buf));
        } catch {}
      };
      recorder.onstop = () => {
        try {
          audioControllerRef.current?.close();
        } catch {}
      };

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const fetchInit: RequestInit & { duplex?: "half" } = {
        method: "POST",
        body: audioStream,
        duplex: "half",
        signal: ctrl.signal,
        headers: { "content-type": "audio/webm" },
      };

      recorder.start(250);

      const res = await fetch("/api/listen", fetchInit);
      if (!res.ok || !res.body) {
        throw new Error(`listen_failed_${res.status}`);
      }

      setStatus("listening");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const chunks = buf.split("\n\n");
            buf = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const lines = chunk.split("\n");
              let isError = false;
              let dataStr = "";
              for (const line of lines) {
                if (line.startsWith("event: error")) isError = true;
                else if (line.startsWith("event: ready")) continue;
                else if (line.startsWith("data: ")) dataStr += line.slice(6);
              }
              if (!dataStr) continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (isError) {
                  setError(parsed.message ?? "deepgram_error");
                  setStatus("error");
                  stop();
                  return;
                }
                handleMessage(parsed as DeepgramMessage);
              } catch {}
            }
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
          console.error("read error", err);
        } finally {
          setStatus((s) => (s === "error" ? s : "idle"));
        }
      })();
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
