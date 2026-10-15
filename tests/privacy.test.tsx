// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PrivacyPage from "@/app/privacy/page";
import {
  NOTICE_TEXT,
  NOTICE_VERSION,
  OPENROUTER_PRIVACY_URL,
  OPENROUTER_TERMS_URL,
  OPENROUTER_ZDR_URL,
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

  it("links to the OpenRouter terms, privacy policy, and ZDR documentation", () => {
    render(<PrivacyPage />);
    const hrefs = Array.from(document.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain(OPENROUTER_TERMS_URL);
    expect(hrefs).toContain(OPENROUTER_PRIVACY_URL);
    expect(hrefs).toContain(OPENROUTER_ZDR_URL);
  });

  it("does not claim Google unpaid Gemini terms", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/unpaid/i);
    expect(text).not.toMatch(/product improvement/i);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).not.toContain("https://ai.google.dev/gemini-api/terms");
    expect(hrefs.some((href) => href?.includes("google"))).toBe(false);
  });
});
