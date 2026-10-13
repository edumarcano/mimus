export const NOTICE_VERSION = "openrouter-zdr-v1";

export const NOTICE_TEXT =
  "Text is sent to OpenRouter to generate a rewrite. OpenRouter routes each request to a third-party model host that it classifies as not storing prompts and not using them for training. OpenRouter still records request metadata, may categorize prompts anonymously, and a host may cache prompt text in memory. This routing is not anonymity. Use fictional text; do not submit personal, confidential, or sensitive information. Mimus does not intentionally save your text on its servers. Optional history stays in this browser.";

export const NOTICE_AVAILABILITY =
  "For adults only. Live generation is currently limited to approved regions and is intended as a writing experiment.";

export const NOTICE_FULL = `${NOTICE_TEXT} ${NOTICE_AVAILABILITY}`;

export const NOTICE_DEMO =
  "Examples are prewritten. Nothing you type is sent anywhere.";

export const NOTICE_ACK_LABEL =
  "I am an adult, I understand this notice, and I won't submit personal or confidential text.";

export const OPENROUTER_TERMS_URL = "https://openrouter.ai/terms";

export const OPENROUTER_PRIVACY_URL = "https://openrouter.ai/privacy";

export const OPENROUTER_ZDR_URL =
  "https://openrouter.ai/docs/guides/features/zdr";

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    id: "live-routing",
    title: "What live mode sends to OpenRouter",
    paragraphs: [
      NOTICE_TEXT,
      "Live generation uses the OpenRouter API with provider preferences that require zero data retention endpoints and deny data collection. Mimus does not pin a single model host, so the terms of the host that serves a given request can vary. OpenRouter's terms and privacy policy, and its description of zero data retention routing, apply to that request.",
      "Zero data retention routing describes how eligible endpoints handle prompts. It is not anonymity, and it does not mean that nobody can see the text. Do not submit personal, sensitive, or confidential information.",
    ],
  },
  {
    id: "server-storage",
    title: "What Mimus stores on its servers",
    paragraphs: [
      "Mimus does not intentionally persist your input or generated rewrite text on its servers, in logs, or in URLs.",
      "Allowlisted operational logs may include a request ID, model ID, prompt version, style IDs, duration, status or error code, and aggregate token counts when reported by the provider. They exclude submitted text, generated text, provider error payloads, raw IP addresses, authorization headers, and full request bodies.",
    ],
  },
  {
    id: "hosting",
    title: "Hosting and network processing",
    paragraphs: [
      "The site is hosted on Vercel. Vercel processes requests as part of serving the application and may record standard request metadata (such as path, timing, and platform geolocation headers used for region checks). Mimus does not operate a separate application database.",
    ],
  },
  {
    id: "browser-storage",
    title: "Browser storage on your device",
    paragraphs: [
      "Style preferences may be saved in localStorage under a versioned key. Optional history (off by default) stores up to ten completed rewrites in localStorage when you turn it on.",
      "Live-mode acknowledgement for the current notice version may be stored in sessionStorage for the browser tab session.",
      "You can clear history from the translator, turn history off (which deletes stored entries), or clear site data in your browser settings.",
    ],
  },
  {
    id: "conditions",
    title: "Age, region, and use conditions",
    paragraphs: [NOTICE_AVAILABILITY],
  },
  {
    id: "demo",
    title: "Demo and unavailable modes",
    paragraphs: [
      "In demo mode, example rewrites are prewritten and labeled. No text you type is transmitted for generation.",
      "When live generation is disabled or unavailable in your region, the translator does not call the model.",
    ],
  },
  {
    id: "disclaimer",
    title: "Independent project",
    paragraphs: [
      "Mimus is an independent project. It is not affiliated with or endorsed by LinkedIn or other style names used as descriptors.",
    ],
  },
];

export const ACK_STORAGE_KEY = "mimus:ack";
