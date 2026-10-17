import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

import { EXAMPLES } from "../src/lib/examples";

test.describe("demo mode", () => {
  test("default Human to LinkedIn Balanced; example labeled; Translate disabled", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByLabel("Source style", { exact: true })).toHaveValue(
      "human",
    );
    await expect(page.getByLabel("Target style", { exact: true })).toHaveValue(
      "linkedin",
    );
    await expect(page.getByLabel("Balanced")).toBeChecked();

    const example = EXAMPLES[0];
    await page.getByRole("button", { name: example.label }).click();
    await expect(page.getByLabel("Your text")).toHaveValue(example.input);
    await expect(page.getByTestId("status")).toContainText(
      "Example — not generated",
    );
    await expect(page.getByTestId("output")).toHaveValue(example.output);
    const rewrite = page.getByRole("textbox", { name: /rewrite$/ });
    await expect(rewrite).not.toBeEditable();
    await rewrite.focus();
    await expect(rewrite).toBeFocused();
    await rewrite.press("ControlOrMeta+A");
    expect(
      await rewrite.evaluate((element: HTMLTextAreaElement) =>
        element.value.slice(element.selectionStart, element.selectionEnd),
      ),
    ).toBe(example.output);

    await expect(
      page.getByRole("button", { name: "Translate" }),
    ).toBeDisabled();
    await expect(page.getByText(/off in demo mode/)).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("brand: single h1 named Mimus, tagline, and privacy back link", async ({
    page,
  }) => {
    await page.goto("/");

    const headings = page.getByRole("heading", { level: 1 });
    await expect(headings).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 1, name: "Mimus" }),
    ).toBeVisible();
    await expect(
      page.getByText("Translate meaning, not just words.", { exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.goto("/privacy");
    await expect(
      page.getByRole("link", { name: "Back to Mimus" }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("link", { name: "Back to Mimus" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { level: 1, name: "Mimus" }),
    ).toBeVisible();
  });

  for (const width of [360, 1440]) {
    test(`keyboard controls and layout at ${width}px with reduced motion`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      expect(
        await page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      const example = page.getByRole("button", { name: EXAMPLES[0].label });
      await example.focus();
      await expect(example).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("output")).toHaveValue(EXAMPLES[0].output);
      await page.getByRole("button", { name: "Clear", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByLabel("Your text")).toHaveValue("");
      await expect(page.getByLabel("Your text")).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    });
  }
});
