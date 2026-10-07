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
    await expect(page.getByTestId("output")).toHaveText(example.output);

    await expect(page.getByRole("button", { name: "Translate" })).toBeDisabled();
    await expect(page.getByText(/off in demo mode/)).toBeVisible();
  });
});
