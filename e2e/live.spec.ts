import { test, expect } from "@playwright/test";

import { NOTICE_VERSION } from "../src/lib/notice";
import { encodeSseEvent } from "../src/lib/stream";

function completeStream(text: string, split = false): string {
  return (
    encodeSseEvent("meta", {
      requestId: "e2e",
      promptVersion: "2",
      effectiveIntensity: "balanced",
    }) +
    encodeSseEvent("delta", { text: split ? text.slice(0, 8) : text }) +
    (split ? encodeSseEvent("delta", { text: text.slice(8) }) : "") +
    encodeSseEvent("done", {
      requestId: "e2e",
      finishReason: "complete",
      durationMs: 3,
    })
  );
}

test.describe("live mode (mocked API)", () => {
  test("requires acknowledgement, streams, copy, regenerate, swap, stop/resubmit, stale, history", async ({
    page,
  }) => {
    const bodies: unknown[] = [];
    let call = 0;
    let stopFlowPass = 0;

    await page.route("**/api/translate", async (route) => {
      call += 1;
      const body = route.request().postDataJSON() as { text?: string };
      bodies.push(body);

      if (body.text === "STOP_FLOW_MARKER") {
        stopFlowPass += 1;
        if (stopFlowPass === 1) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          await route.fulfill({
            status: 200,
            contentType: "text/event-stream; charset=utf-8",
            body:
              encodeSseEvent("meta", {
                requestId: "e2e",
                promptVersion: "2",
                effectiveIntensity: "balanced",
              }) + encodeSseEvent("delta", { text: "OLD_RUN" }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream; charset=utf-8",
          body: completeStream("NEW_RUN complete."),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: completeStream("Streamed rewrite for e2e.", call === 1),
      });
    });

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
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
    await expect(page.getByTestId("status")).toHaveText("Complete", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("output")).toHaveValue(
      "Streamed rewrite for e2e.",
    );

    await page.getByRole("button", { name: "Copy result" }).click();
    await expect(page.getByTestId("copy-note")).toContainText("Copied");

    await page.getByRole("button", { name: "Regenerate" }).click();
    await expect(page.getByTestId("status")).toHaveText("Complete");
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(bodies[1])).not.toContain("Streamed rewrite");
    expect((bodies[1] as { text: string }).text).toBe("hello e2e");

    await page.getByRole("button", { name: "Swap" }).click();
    await expect(page.getByLabel("Source style", { exact: true })).toHaveValue(
      "linkedin",
    );
    await expect(page.getByLabel("Target style", { exact: true })).toHaveValue(
      "human",
    );

    await page.getByLabel("Your text").fill("STOP_FLOW_MARKER");
    await translate.click();
    await expect(page.getByTestId("status")).toHaveText("Generating");
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByTestId("status")).toContainText("Stopped");
    await translate.click();
    await expect(page.getByTestId("output")).toHaveValue("NEW_RUN complete.");
    await expect(page.getByTestId("output")).not.toHaveValue(/OLD_RUN/);

    await page.getByLabel("Your text").fill("edited after complete");
    await expect(page.getByTestId("stale")).toContainText("previous input");

    await page.getByText("History in this browser").click();
    const historyToggle = page.getByLabel(
      "Save completed rewrites in this browser",
    );
    await expect(historyToggle).not.toBeChecked();
    await historyToggle.check();
    await page.getByLabel("Your text").fill("history save");
    await translate.click();
    await expect(page.getByTestId("status")).toHaveText("Complete");
    await expect(page.getByRole("button", { name: "Load" })).toBeVisible();
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

    await page.goto("/");
    await page.getByLabel(/I am an adult/).check();
    await page.getByLabel("Your text").fill("QUOTA_CASE");
    await page.getByRole("button", { name: "Translate" }).click();
    await expect(page.getByTestId("status")).toContainText(
      "Shared free capacity",
    );

    await page.getByLabel("Your text").fill("other");
    await page.getByRole("button", { name: "Translate" }).click();
    await expect(page.getByTestId("status")).toContainText("unavailable");
    await expect(page.getByTestId("status")).not.toContainText("<html>");
  });

  test("layout at 360px has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test("submitted payload includes notice version", async ({ page }) => {
    let captured: unknown;
    await page.route("**/api/translate", async (route) => {
      captured = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: completeStream("ok"),
      });
    });
    await page.goto("/");
    await page.getByLabel(/I am an adult/).check();
    await page.getByLabel("Your text").fill("payload check");
    await page.getByRole("button", { name: "Translate" }).click();
    await expect(page.getByTestId("status")).toHaveText("Complete");
    expect(captured).toMatchObject({
      privacyNoticeVersion: NOTICE_VERSION,
      eligibilityConfirmed: true,
    });
  });
});
