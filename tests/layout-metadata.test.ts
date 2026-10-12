import { describe, expect, it } from "vitest";
import { metadata } from "@/app/layout";

describe("root metadata", () => {
  it("resolves social images against the canonical Mimus origin", () => {
    const base = new URL(String(metadata.metadataBase));
    expect(base.origin).toBe("https://mimus-rewrite.vercel.app");
  });
});
