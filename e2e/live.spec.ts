import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

import { NOTICE_VERSION } from "../src/lib/notice";
import { encodeSseEvent } from "../src/lib/stream";
import {
  completeStream,
  installStreamGates,
  releaseStream,
  waitForStream,
} from "./stream-fixture";

async function ready(page: Page, text = "hello e2e") {
  await page.goto("/");
  await page.getByLabel(/I am an adult/).check();
  await page.getByLabel("Your text").fill(text);
}

async function mockCompletedResponse(
  page: Page,
  output = "Streamed rewrite for e2e.",
) {
  await page.route("**/api/translate", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body: completeStream(output),
    }),
  );
}

test.describe("live mode (mocked browser/API; no provider calls)", () => {
  test("requires acknowledgement; generates, copies, and regenerates original input", async ({
    page,
  }) => {
    const bodies: unknown[] = [];
    await page.route("**/api/translate", (route) => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: completeStream("Streamed rewrite for e2e."),
      });
    });
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await expect(page.getByTestId("availability")).toContainText(
      "Gemini 3.5 Flash-Lite",
    );
    const translate = page.getByRole("button", { name: "Translate" });
    await expect(translate).toBeDisabled();
    await page.getByLabel("Your text").fill("hello e2e");
    await expect(translate).toBeDisabled();
    await page.getByLabel(/I am an adult/).check();
    await expect(translate).toBeEnabled();
    await translate.click();
    await expect(page.getByTestId("status")).toHaveText("Complete");
    await expect(page.getByTestId("output")).toHaveValue(
      "Streamed rewrite for e2e.",
    );
    await page.getByRole("button", { name: "Copy result" }).click();
    await expect(page.getByTestId("copy-note")).toContainText("Copied");
    await page.getByRole("button", { name: "Regenerate" }).click();
    await expect.poll(() => bodies.length).toBe(2);
    await expect(page.getByTestId("status")).toHaveText("Complete");
    expect(bodies[1]).toMatchObject({
      text: "hello e2e",
      privacyNoticeVersion: NOTICE_VERSION,
      eligibilityConfirmed: true,
    });
    expect(JSON.stringify(bodies[1])).not.toContain("Streamed rewrite");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("renders partial output before a gated mocked stream completes", async ({
    page,
  }) => {
    await installStreamGates(page);
    await ready(page);
    await page.getByRole("button", { name: "Translate" }).click();
    await waitForStream(page, 1);
    await releaseStream(
      page,
      0,
      encodeSseEvent("meta", {
        requestId: "e2e",
        promptVersion: "2",
        effectiveIntensity: "balanced",
      }) + encodeSseEvent("delta", { text: "Partial rewrite" }),
    );
    await expect(page.getByTestId("output")).toHaveValue("Partial rewrite");
    await expect(page.getByTestId("status")).toHaveText("Generating");
    await expect(
      page.getByRole("button", { name: "Copy result" }),
    ).toBeDisabled();
    await releaseStream(
      page,
      0,
      encodeSseEvent("delta", { text: " complete." }) +
        encodeSseEvent("done", {
          requestId: "e2e",
          finishReason: "complete",
          durationMs: 3,
        }),
      true,
    );
    await expect(page.getByTestId("status")).toHaveText("Complete");
    await expect(page.getByTestId("output")).toHaveValue(
      "Partial rewrite complete.",
    );
  });

  test("swaps completed output into input with focus, then marks edits stale", async ({
    page,
  }) => {
    await mockCompletedResponse(page);
    await ready(page);
    await page.getByRole("button", { name: "Translate" }).click();
    await expect(page.getByTestId("status")).toHaveText("Complete");
    await page
      .getByRole("button", { name: "Swap source and target styles" })
      .click();
    await expect(page.getByLabel("Source style", { exact: true })).toHaveValue(
      "linkedin",
    );
    await expect(page.getByLabel("Target style", { exact: true })).toHaveValue(
      "human",
    );
    await expect(page.getByLabel("Your text")).toHaveValue(
      "Streamed rewrite for e2e.",
    );
    await expect(page.getByLabel("Your text")).toBeFocused();
    await page.getByRole("button", { name: "Translate" }).click();
    await expect(page.getByTestId("status")).toHaveText("Complete");
    await page.getByLabel("Your text").fill("edited after complete");
    await expect(page.getByTestId("stale")).toContainText("previous input");
  });

  test("Stop permits immediate resubmission and ignores late events from the old run", async ({
    page,
  }) => {
    await installStreamGates(page);
    await ready(page);
    const translate = page.getByRole("button", { name: "Translate" });
    await translate.click();
    await waitForStream(page, 1);
    await releaseStream(
      page,
      0,
      encodeSseEvent("delta", { text: "Old partial" }),
    );
    await expect(page.getByTestId("output")).toHaveValue("Old partial");
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByTestId("status")).toContainText("Stopped");
    await translate.click();
    await waitForStream(page, 2);
    await releaseStream(page, 1, completeStream("NEW_RUN complete."), true);
    await expect(page.getByTestId("status")).toHaveText("Complete");
    await expect(page.getByTestId("output")).toHaveValue("NEW_RUN complete.");
    await releaseStream(page, 0, completeStream("OLD_RUN late result."));
    await expect
      .poll(() => page.evaluate(() => window.mimusMockStreams[0].canceled))
      .toBe(true);
    await expect(page.getByTestId("output")).toHaveValue("NEW_RUN complete.");
    await expect(page.getByTestId("status")).toHaveText("Complete");
  });

  test("history starts off; opt-in saves and loads completed results; clear deletes them", async ({
    page,
  }) => {
    await mockCompletedResponse(page);
    await ready(page, "history save");
    await page.getByText("History in this browser").click();
    const historyToggle = page.getByLabel(
      "Save completed rewrites in this browser",
    );
    await expect(historyToggle).not.toBeChecked();
    await historyToggle.check();
    await page.getByRole("button", { name: "Translate" }).click();
    await expect(page.getByTestId("status")).toHaveText("Complete");
    await expect(
      page.getByRole("button", { name: "Load", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Your text").fill("edited");
    await page.getByRole("button", { name: "Load", exact: true }).click();
    await expect(page.getByLabel("Your text")).toHaveValue("history save");
    await expect(page.getByTestId("status")).toContainText("From history");
    await page.getByRole("button", { name: "Clear history" }).click();
    await expect(
      page.getByRole("button", { name: "Load", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await page.getByText("History in this browser").click();
    await expect(
      page.getByRole("button", { name: "Load", exact: true }),
    ).toHaveCount(0);
  });

  test("shows quota and unavailable messages", async ({ page }) => {
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON() as { text?: string };
      if (body.text === "QUOTA_CASE") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "SERVICE_QUOTA_EXHAUSTED", message: "Quota." },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: "text/html",
        body: "<html>Unavailable</html>",
      });
    });
    await ready(page, "QUOTA_CASE");
    await page.getByRole("button", { name: "Translate" }).click();
    await expect(page.getByTestId("status")).toContainText(
      "Shared free capacity",
    );
    await page.getByLabel("Your text").fill("other");
    await page.getByRole("button", { name: "Translate" }).click();
    await expect(page.getByTestId("status")).toContainText("unavailable");
    await expect(page.getByTestId("status")).not.toContainText("<html>");
  });
});
