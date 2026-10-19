import Link from "next/link";
import {
  NOTICE_VERSION,
  GOOGLE_ABUSE_MONITORING_URL,
  GOOGLE_DATA_GOVERNANCE_URL,
  OPENROUTER_LOGGING_URL,
  OPENROUTER_PRIVACY_URL,
  OPENROUTER_TERMS_URL,
  PRIVACY_SECTIONS,
} from "@/lib/notice";

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <p className="text-sm text-ink-soft">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-medium text-accent-strong underline underline-offset-4"
          >
            Back to Mimus
          </Link>
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Privacy and data use
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Notice version:{" "}
          <span data-testid="notice-version">{NOTICE_VERSION}</span>
        </p>
      </header>

      <main className="flex-1 space-y-8 text-ink">
        {PRIVACY_SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={`${section.id}-h`}>
            <h2
              id={`${section.id}-h`}
              className="text-lg font-semibold text-ink"
            >
              {section.title}
            </h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="mt-2 text-ink-soft">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section aria-labelledby="openrouter-terms-h">
          <h2
            id="openrouter-terms-h"
            className="text-lg font-semibold text-ink"
          >
            Provider data handling
          </h2>
          <p className="mt-2 text-ink-soft">
            Read{" "}
            <a
              href={OPENROUTER_TERMS_URL}
              className="font-medium text-accent-strong underline underline-offset-4"
            >
              OpenRouter&apos;s terms
            </a>
            {", "}
            <a
              href={OPENROUTER_PRIVACY_URL}
              className="font-medium text-accent-strong underline underline-offset-4"
            >
              OpenRouter&apos;s privacy policy
            </a>
            {", "}
            <a
              href={OPENROUTER_LOGGING_URL}
              className="font-medium text-accent-strong underline underline-offset-4"
            >
              data logging documentation
            </a>
            , and Google&apos;s{" "}
            <a
              href={GOOGLE_DATA_GOVERNANCE_URL}
              className="font-medium text-accent-strong underline underline-offset-4"
            >
              data governance policy
            </a>
            {" and "}
            <a
              href={GOOGLE_ABUSE_MONITORING_URL}
              className="font-medium text-accent-strong underline underline-offset-4"
            >
              abuse monitoring policy
            </a>
            . Mimus requests OpenRouter ZDR routing; eligible hosts depend on
            OpenRouter and the applicable account and guardrail settings,
            including safety-retention exceptions.
          </p>
        </section>
      </main>
    </div>
  );
}
