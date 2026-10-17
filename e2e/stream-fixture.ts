import { expect, type Page } from "@playwright/test";

import { encodeSseEvent } from "../src/lib/stream";

declare global {
  interface Window {
    mimusMockStreams: {
      body: unknown;
      controller: ReadableStreamDefaultController<Uint8Array>;
      canceled: boolean;
    }[];
  }
}

export function completeStream(text: string): string {
  return (
    encodeSseEvent("meta", {
      requestId: "e2e",
      promptVersion: "2",
      effectiveIntensity: "balanced",
    }) +
    encodeSseEvent("delta", { text }) +
    encodeSseEvent("done", {
      requestId: "e2e",
      finishReason: "complete",
      durationMs: 3,
    })
  );
}

// Browser-only stream gates exercise rendering and stale-run handling. They do
// not establish deployed HTTP streaming, provider behavior, or billing behavior.
export async function installStreamGates(page: Page) {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.mimusMockStreams = [];
    window.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (new URL(url, location.href).pathname !== "/api/translate") {
        return originalFetch(input, init);
      }
      const index = window.mimusMockStreams.length;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          window.mimusMockStreams.push({
            body: JSON.parse(String(init?.body)),
            controller,
            canceled: false,
          });
        },
        cancel() {
          window.mimusMockStreams[index].canceled = true;
        },
      });
      // Deliberately keep this controllable stream alive after abort so the test
      // can deliver late old-run events and verify the application's run guard.
      return new Response(stream, {
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      });
    };
  });
}

export async function waitForStream(page: Page, count: number) {
  await expect
    .poll(() => page.evaluate(() => window.mimusMockStreams.length))
    .toBe(count);
}

export async function releaseStream(
  page: Page,
  index: number,
  events: string,
  close = false,
) {
  await page.evaluate(
    ({ index, events, close }) => {
      const { controller } = window.mimusMockStreams[index];
      controller.enqueue(new TextEncoder().encode(events));
      if (close) controller.close();
    },
    { index, events, close },
  );
}
