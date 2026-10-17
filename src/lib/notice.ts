export const NOTICE_VERSION = "openrouter-vertex-safety-v1";

export const NOTICE_TEXT =
  "Your text is sent through OpenRouter to Google Vertex AI, which generates the rewrite. Mimus routes requests only to Google Vertex endpoints. OpenRouter records request metadata and may categorize prompts anonymously. Google may retain prompts and responses for safety and abuse monitoring, and flagged content may be reviewed by people. Under Google's applicable policies, this content is not used to train or fine-tune models without permission or instruction. Provider caching may occur. This is not anonymity. Use fictional text; do not submit personal, confidential, or sensitive information. Mimus does not intentionally save your text on its servers. Optional history stays in this browser.";

export const NOTICE_AVAILABILITY =
  "For adults only. Live generation is currently limited to approved regions and is intended as a writing experiment.";

export const NOTICE_FULL = `${NOTICE_TEXT} ${NOTICE_AVAILABILITY}`;

export const NOTICE_DEMO =
  "Examples are prewritten. Nothing you type is sent anywhere.";

export const NOTICE_ACK_LABEL =
  "I am an adult, I understand this notice, and I won't submit personal or confidential text.";

export const OPENROUTER_TERMS_URL = "https://openrouter.ai/terms";

export const OPENROUTER_PRIVACY_URL = "https://openrouter.ai/privacy";

export const OPENROUTER_LOGGING_URL =
  "https://openrouter.ai/docs/guides/privacy/provider-logging";

export const GOOGLE_DATA_GOVERNANCE_URL =
  "https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention";

export const GOOGLE_ABUSE_MONITORING_URL =
  "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/abuse-monitoring";

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    id: "live-routing",
    title: "What live mode sends to OpenRouter and Google",
    paragraphs: [
      NOTICE_TEXT,
      "OpenRouter receives the request and routes it only to Google Vertex endpoints. OpenRouter content logging is disabled for Mimus; OpenRouter may record request metadata under its policies. Google Vertex may retain prompts and responses for safety and abuse monitoring, and flagged content may receive human review. Google states that it does not use customer data to train or fine-tune models without permission or instruction. Provider caching may occur under the applicable service terms.",
      "These provider controls do not make a request anonymous. Do not submit personal, sensitive, or confidential information.",
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
