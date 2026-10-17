import Link from "next/link";
import {
  NOTICE_VERSION,
  OPENROUTER_PRIVACY_URL,
  OPENROUTER_TERMS_URL,
  OPENROUTER_ZDR_URL,
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
            OpenRouter terms and policies
          </h2>
          <p className="mt-2 text-ink-soft">
            Live generation uses the OpenRouter API. Read{" "}
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
            {", and its "}
            <a
              href={OPENROUTER_ZDR_URL}
              className="font-medium text-accent-strong underline underline-offset-4"
            >
              zero data retention documentation
            </a>
            . Downstream model-host terms vary because Mimus does not pin a
            single host.
          </p>
        </section>
      </main>
    </div>
  );
}
