import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
});

const KEY = "memoryshift.a11y.v1";

export function loadSettings(): A11ySettings {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...(JSON.parse(raw) as A11ySettings) };
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
  speak: (text: string) => void;
  stopSpeaking: () => void;
  speaking: boolean;
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

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = settings.speechRate;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [settings.speechRate],
  );

  useEffect(() => () => stopSpeaking(), [stopSpeaking]);

  const value = useMemo(
    () => ({ settings, update, reset, speak, stopSpeaking, speaking }),
    [settings, update, reset, speak, stopSpeaking, speaking],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error("useA11y must be used inside A11yProvider");
  return ctx;
}
