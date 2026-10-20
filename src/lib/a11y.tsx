import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { speechClip } from "@/lib/audio";
import type { VoiceId } from "@/lib/audio.functions";
import type { LocaleStyle } from "@/lib/locale";

export type FontChoice = "lexend" | "atkinson" | "system" | "serif" | "mono";
export type ContrastChoice = "cream" | "white" | "dark" | "high";

export type A11ySettings = {
  font: FontChoice;
  fontSize: number; // px base
  letterSpacing: number; // em
  wordSpacing: number; // em
  lineHeight: number;
  contrast: ContrastChoice;
  animations: boolean;
  reducedMotion: boolean;
  speechRate: number; // 0.5 - 1.5
  readingRuler: boolean;
  /** "natural" = AI voice (falls back to the device voice), "device" = built-in voice. */
  voice: "natural" | "device";
  naturalVoice: VoiceId;
  /** Who the app is made for: shapes wording, examples and accent. */
  localeStyle: LocaleStyle;
  /** Memory aids and questions play by themselves when they appear. */
  audioFirst: boolean;
};

export const FONT_STACKS: Record<FontChoice, { label: string; stack: string }> = {
  lexend: { label: "Lexend (default)", stack: '"Lexend", system-ui, sans-serif' },
  atkinson: {
    label: "Atkinson Hyperlegible",
    stack: '"Atkinson Hyperlegible", system-ui, sans-serif',
  },
  system: { label: "My device font", stack: "system-ui, sans-serif" },
  serif: { label: "Serif", stack: 'Georgia, "Times New Roman", serif' },
  mono: { label: "Even-width letters", stack: 'ui-monospace, "Courier New", monospace' },
};

export const defaultSettings = (): A11ySettings => ({
  font: "lexend",
  fontSize: 18,
  letterSpacing: 0.012,
  wordSpacing: 0.06,
  lineHeight: 1.7,
  contrast: "cream",
  animations: true,
  reducedMotion: false,
  speechRate: 0.9,
  readingRuler: false,
  voice: "natural",
  naturalVoice: "teacher",
  localeStyle: "ng",
  audioFirst: true,
});

const KEY = "memoryshift.a11y.v1";

export function loadSettings(): A11ySettings {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    const stored = JSON.parse(raw) as Partial<A11ySettings> & { naturalVoice?: string };
    // Older versions had "warm" and "bright" voices.
    const legacy: Record<string, VoiceId> = { warm: "teacher", bright: "bigbrother" };
    const voice = stored.naturalVoice && legacy[stored.naturalVoice];
    return { ...defaultSettings(), ...stored, ...(voice ? { naturalVoice: voice } : {}) } as A11ySettings;
  } catch {
    return defaultSettings();
  }
}

export function applySettings(settings: A11ySettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset["contrast"] = settings.contrast;
  root.classList.toggle("dark", settings.contrast === "dark");
  root.dataset["motion"] = settings.reducedMotion || !settings.animations ? "reduced" : "full";
  root.style.setProperty("--app-font", FONT_STACKS[settings.font].stack);
  root.style.setProperty("--app-font-size", `${settings.fontSize}px`);
  root.style.setProperty("--app-letter-spacing", `${settings.letterSpacing}em`);
  root.style.setProperty("--app-word-spacing", `${settings.wordSpacing}em`);
  root.style.setProperty("--app-line-height", String(settings.lineHeight));
}

type Ctx = {
  settings: A11ySettings;
  update: (patch: Partial<A11ySettings>) => void;
  reset: () => void;
  /** Read text aloud. Resolves when it finishes (or is stopped). */
  speak: (text: string) => Promise<void>;
  /** Read several parts in order, reporting which part is playing. */
  speakParts: (parts: string[], onPart?: (index: number) => void) => Promise<void>;
  stopSpeaking: () => void;
  speaking: boolean;
  /** The text currently being read, so each button knows if it is the one playing. */
  speakingText: string | null;
  /** True while a natural-voice clip is being fetched. */
  loadingVoice: boolean;
  /** Which voice actually played last, and why the AI voice was skipped if it was. */
  voiceStatus: { source: "natural" | "device"; reason?: string } | null;
  /** Play a sample in a specific voice (for choosing a voice). */
  preview: (voice: VoiceId, text: string) => Promise<void>;
};

const A11yContext = createContext<Ctx | null>(null);

export function A11yProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<A11ySettings>(defaultSettings);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const loaded = loadSettings();
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const merged = prefersReduced ? { ...loaded, reducedMotion: true } : loaded;
    setSettings(merged);
    applySettings(merged);
  }, []);

  const update = useCallback((patch: Partial<A11ySettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      applySettings(next);
      if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = defaultSettings();
    setSettings(next);
    applySettings(next);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<Ctx["voiceStatus"]>(null);
  const voiceOverride = useRef<VoiceId | null>(null);
  const run = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const warned = useRef(false);

  const stopSpeaking = useCallback(() => {
    run.current++;
    if (audio.current) {
      audio.current.pause();
      audio.current.src = "";
    }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
    setSpeakingText(null);
    setLoadingVoice(false);
  }, []);

  /** Play one piece of text; resolves when done. Returns false if stopped. */
  const playOne = useCallback(
    async (text: string, token: number): Promise<boolean> => {
      if (typeof window === "undefined" || !text.trim()) return true;
      if (settings.voice === "natural") {
        try {
          setLoadingVoice(true);
          const blob = await speechClip(
            text,
            voiceOverride.current ?? settings.naturalVoice,
            settings.localeStyle,
          );
          setLoadingVoice(false);
          if (token !== run.current) return false;
          const el = audio.current ?? new Audio();
          audio.current = el;
          const url = URL.createObjectURL(blob);
          el.src = url;
          el.playbackRate = settings.speechRate / 0.9;
          const ended = new Promise<void>((resolve) => {
            el.onended = () => resolve();
            el.onerror = () => resolve();
            el.onpause = () => resolve();
          });
          await el.play();
          setVoiceStatus({ source: "natural" });
          await ended;
          URL.revokeObjectURL(url);
          return token === run.current;
        } catch (error) {
          setLoadingVoice(false);
          if (token !== run.current) return false;
          setVoiceStatus({
            source: "device",
            reason: error instanceof Error ? error.message : "The AI voice did not load",
          });
          if (!warned.current) {
            warned.current = true;
            toast.message("Using this device's voice for now", {
              description: error instanceof Error ? error.message : undefined,
            });
          }
        }
      }
      if (!window.speechSynthesis) return true;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.speechRate;
      await new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
      return token === run.current;
    },
    [settings.voice, settings.naturalVoice, settings.localeStyle, settings.speechRate],
  );

  const speakParts = useCallback(
    async (parts: string[], onPart?: (index: number) => void) => {
      stopSpeaking();
      const token = ++run.current;
      const all = parts.join(". ");
      setSpeaking(true);
      setSpeakingText(all);
      // Fetch the next clip while the current one plays.
      if (settings.voice === "natural") {
        parts
          .slice(0, 2)
          .forEach(
            (p) => void speechClip(p, settings.naturalVoice, settings.localeStyle).catch(() => undefined),
          );
      }
      for (let i = 0; i < parts.length; i++) {
        if (token !== run.current) return;
        onPart?.(i);
        const next = parts[i + 1];
        if (next && settings.voice === "natural") {
          void speechClip(next, settings.naturalVoice, settings.localeStyle).catch(() => undefined);
        }
        const finished = await playOne(parts[i]!, token);
        if (!finished) return;
      }
      if (token === run.current) {
        setSpeaking(false);
        setSpeakingText(null);
        onPart?.(-1);
      }
    },
    [playOne, stopSpeaking, settings.voice, settings.naturalVoice, settings.localeStyle],
  );

  const speak = useCallback((text: string) => speakParts([text]), [speakParts]);

  const preview = useCallback(
    async (voice: VoiceId, text: string) => {
      voiceOverride.current = voice;
      try {
        await speakParts([text]);
      } finally {
        voiceOverride.current = null;
      }
    },
    [speakParts],
  );

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  const value = useMemo(
    () => ({
      settings,
      update,
      reset,
      speak,
      speakParts,
      stopSpeaking,
      speaking,
      speakingText,
      loadingVoice,
      voiceStatus,
      preview,
    }),
    [
      settings,
      update,
      reset,
      speak,
      speakParts,
      stopSpeaking,
      speaking,
      speakingText,
      loadingVoice,
      voiceStatus,
      preview,
    ],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useA11y must be used inside A11yProvider");
  return ctx;
}
