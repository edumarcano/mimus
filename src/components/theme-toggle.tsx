"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Theme = "system" | "dark" | "light";

export const THEME_STORAGE_KEY = "mimus:theme";

function getSystemPrefersDark(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const isDark =
    theme === "dark" || (theme === "system" && getSystemPrefersDark());
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (typeof window === "undefined") {
    return () => listeners.delete(callback);
  }

  const handleStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", handleStorage);

  let removeMedia: (() => void) | undefined;
  if (typeof window.matchMedia === "function") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleMedia = () => callback();
    if (mq.addEventListener) {
      mq.addEventListener("change", handleMedia);
      removeMedia = () => mq.removeEventListener("change", handleMedia);
    } else if (
      (mq as unknown as { addListener?: (h: () => void) => void }).addListener
    ) {
      (mq as unknown as { addListener: (h: () => void) => void }).addListener(
        handleMedia,
      );
      removeMedia = () => {
        (
          mq as unknown as { removeListener: (h: () => void) => void }
        ).removeListener(handleMedia);
      };
    }
  }

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
    removeMedia?.();
  };
}

function getSnapshot(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Storage access denied
  }
  return "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const cycleTheme = () => {
    const nextTheme: Theme =
      theme === "system" ? "dark" : theme === "dark" ? "light" : "system";
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Storage access denied
    }
    applyTheme(nextTheme);
    notify();
  };

  const currentLabel =
    theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";
  const nextLabel =
    theme === "system" ? "Dark" : theme === "dark" ? "Light" : "System";

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      data-theme={theme}
      onClick={cycleTheme}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-control-line bg-surface p-2 text-ink transition-colors hover:border-accent hover:text-accent-strong focus-visible:outline-3 focus-visible:outline-accent ${className}`}
      aria-label={`Theme: ${currentLabel}. Click to switch to ${nextLabel}.`}
      title={`Theme: ${currentLabel} (click for ${nextLabel})`}
    >
      {theme === "light" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : theme === "dark" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      )}
    </button>
  );
}
