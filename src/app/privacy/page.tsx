import Link from "next/link";
import {
  GOOGLE_TERMS_URL,
  NOTICE_VERSION,
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
            Back to Parlance
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

        <section aria-labelledby="google-terms-h">
          <h2 id="google-terms-h" className="text-lg font-semibold text-ink">
            Google API terms
          </h2>
          <p className="mt-2 text-ink-soft">
            Live generation uses Google&apos;s Gemini Developer API. See{" "}
            <a
              href={GOOGLE_TERMS_URL}
              className="font-medium text-accent-strong underline underline-offset-4"
            >
              Google&apos;s Gemini API terms
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
