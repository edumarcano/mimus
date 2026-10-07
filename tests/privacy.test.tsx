// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacyPage from "@/app/privacy/page";
import { NOTICE_TEXT, NOTICE_VERSION } from "@/lib/notice";

describe("/privacy page", () => {
  it("renders shared notice text and version", () => {
    render(<PrivacyPage />);
    expect(screen.getByTestId("notice-version").textContent).toBe(
      NOTICE_VERSION,
    );
    expect(screen.getByText(NOTICE_TEXT)).toBeTruthy();
  });
});
