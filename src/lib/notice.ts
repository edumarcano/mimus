export const NOTICE_VERSION = "google-unpaid-v1";

export const NOTICE_TEXT =
  "Text is sent to Google to generate a rewrite. Google may use input and output to improve its products, and human reviewers may review it. Use fictional text; do not submit personal, confidential, or sensitive information. Mimus does not intentionally save your text on its servers. Optional history stays in this browser.";

export const NOTICE_AVAILABILITY =
  "For adults only. Live generation is currently limited to approved regions and is intended for professional writing experiments.";

export const NOTICE_FULL = `${NOTICE_TEXT} ${NOTICE_AVAILABILITY}`;

export const NOTICE_DEMO =
  "Examples are prewritten. Nothing you type is sent anywhere.";

export const NOTICE_ACK_LABEL =
  "I am an adult, I understand this notice, and I won't submit personal or confidential text.";

export const GOOGLE_TERMS_URL =
  "https://ai.google.dev/gemini-api/terms";

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    id: "google-live",
    title: "What live mode sends to Google",
    paragraphs: [
      NOTICE_TEXT,
      "This project uses Google's unpaid Gemini Developer API terms. Google may use submitted content to improve its products, and human reviewers may review it. Do not submit personal, sensitive, or confidential information.",
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
