// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Translator, type TranslatorConfig } from "@/components/translator";
import { EXAMPLES } from "@/lib/examples";
import { encodeSseEvent } from "@/lib/stream";

const base: Omit<TranslatorConfig, "mode"> = {
  notice: { version: "v-test", text: "Notice text." },
  limits: { maxInputCodePoints: 3000 },
};
const cfg = (mode: TranslatorConfig["mode"]): TranslatorConfig => ({
  ...base,
  mode,
});

const translateBtn = () =>
  screen.getByRole("button", { name: /^Translate$/ }) as HTMLButtonElement;

function sseResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText("Your text"), {
    target: { value: "hello there" },
  });
  fireEvent.click(screen.getByLabelText(/I am an adult/));
  fireEvent.click(translateBtn());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Translator", () => {
  it("demo mode: Translate disabled with explanation; example shows labeled output", () => {
    render(<Translator config={cfg("demo")} />);
    expect(translateBtn().disabled).toBe(true);
    expect(screen.getByText(/off in demo mode/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: EXAMPLES[0].label }));
    expect(
      (screen.getByLabelText("Your text") as HTMLTextAreaElement).value,
    ).toBe(EXAMPLES[0].input);
    expect(screen.getByTestId("status").textContent).toContain(
      "Example — not generated",
    );
    expect(screen.getByTestId("output").textContent).toBe(EXAMPLES[0].output);
    expect(translateBtn().disabled).toBe(true);
  });

  it("live mode: Translate needs text and acknowledgement; chip does not show output", () => {
    render(<Translator config={cfg("live")} />);
    expect(translateBtn().disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: EXAMPLES[0].label }));
    expect(screen.getByTestId("status").textContent).toBe("Idle");
    expect(screen.getByTestId("output").textContent).not.toBe(
      EXAMPLES[0].output,
    );
    expect(translateBtn().disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(/I am an adult/));
    expect(translateBtn().disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("Your text"), {
      target: { value: "   " },
    });
    expect(translateBtn().disabled).toBe(true);
  });

  it("shows over-limit state and disables Translate", () => {
    render(<Translator config={cfg("live")} />);
    fireEvent.click(screen.getByLabelText(/I am an adult/));
    fireEvent.change(screen.getByLabelText("Your text"), {
      target: { value: "a".repeat(3001) },
    });
    expect(screen.getByTestId("counter").textContent).toContain("over the limit");
    expect(translateBtn().disabled).toBe(true);
  });

  it("streams split chunks and completes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      (() => {
        const all =
          encodeSseEvent("meta", {
            requestId: "r",
            promptVersion: "p",
            effectiveIntensity: "balanced",
          }) +
          encodeSseEvent("delta", { text: "Excited to " }) +
          encodeSseEvent("delta", { text: "share!" }) +
          encodeSseEvent("done", {
            requestId: "r",
            finishReason: "complete",
            durationMs: 1,
          });
        const mid = Math.floor(all.length / 2);
        return sseResponse([all.slice(0, mid), all.slice(mid)]);
      })(),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("Complete"),
    );
    expect(screen.getByTestId("output").textContent).toBe("Excited to share!");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      sourceStyle: "human",
      targetStyle: "linkedin",
      intensity: "balanced",
      eligibilityConfirmed: true,
      privacyNoticeVersion: "v-test",
    });
  });

  it("shows Interrupted when the stream ends without a terminal event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([encodeSseEvent("delta", { text: "Partial" })]),
      ),
    );
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toContain("Interrupted"),
    );
    expect(screen.getByTestId("output").textContent).toBe("Partial");
    expect(
      (screen.getByLabelText("Your text") as HTMLTextAreaElement).value,
    ).toBe("hello there");
  });

  it("keeps partial text as Interrupted when the connection drops mid-stream", async () => {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(encodeSseEvent("delta", { text: "Partial" })));
        setTimeout(() => controller.error(new TypeError("network")), 0);
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toContain("Interrupted"),
    );
    expect(screen.getByTestId("output").textContent).toBe("Partial");
  });

  it("removes partial text on CONTENT_BLOCKED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          encodeSseEvent("delta", { text: "Partial" }),
          encodeSseEvent("error", {
            code: "CONTENT_BLOCKED",
            message: "Blocked.",
            requestId: "r",
          }),
        ]),
      ),
    );
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toContain("Blocked."),
    );
    expect(screen.getByTestId("output").textContent).not.toContain("Partial");
  });

  it("shows a safe message for a non-JSON 503 body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Bad gateway <script>x</script></html>", {
          status: 503,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toContain("Error"),
    );
    const text = screen.getByTestId("status").textContent ?? "";
    expect(text).toContain("unavailable");
    expect(text).not.toContain("<html>");
  });
});
