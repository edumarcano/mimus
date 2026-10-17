// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PrivacyPage from "@/app/privacy/page";
import {
  NOTICE_TEXT,
  NOTICE_VERSION,
  GOOGLE_ABUSE_MONITORING_URL,
  GOOGLE_DATA_GOVERNANCE_URL,
  OPENROUTER_LOGGING_URL,
  OPENROUTER_PRIVACY_URL,
  OPENROUTER_TERMS_URL,
} from "@/lib/notice";

describe("/privacy page", () => {
  afterEach(cleanup);

  it("renders shared notice text and version", () => {
    render(<PrivacyPage />);
    expect(screen.getByTestId("notice-version").textContent).toBe(
      NOTICE_VERSION,
    );
    expect(screen.getByText(NOTICE_TEXT)).toBeTruthy();
  });

  it("links to OpenRouter and Google data-handling policies", () => {
    render(<PrivacyPage />);
    const hrefs = Array.from(document.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain(OPENROUTER_TERMS_URL);
    expect(hrefs).toContain(OPENROUTER_PRIVACY_URL);
    expect(hrefs).toContain(OPENROUTER_LOGGING_URL);
    expect(hrefs).toContain(GOOGLE_DATA_GOVERNANCE_URL);
    expect(hrefs).toContain(GOOGLE_ABUSE_MONITORING_URL);
  });

  it("describes the approved provider route and safety retention accurately", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/unpaid/i);
    expect(text).not.toMatch(/product improvement/i);
    expect(text).toMatch(/only to Google Vertex endpoints/i);
    expect(text).toMatch(/may retain prompts and responses/i);
    expect(text).toMatch(/flagged content may be reviewed by people/i);
    expect(text).toMatch(/not used to train or fine-tune models/i);
    expect(text).toMatch(/Provider caching may occur/i);
    expect(text).not.toMatch(/zero data retention/i);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).not.toContain("https://ai.google.dev/gemini-api/terms");
    expect(hrefs).toContain(GOOGLE_DATA_GOVERNANCE_URL);
    expect(hrefs).toContain(GOOGLE_ABUSE_MONITORING_URL);
  });
});
