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
import { addEntry, HISTORY_STORAGE_KEY } from "@/lib/history";
import { ACK_STORAGE_KEY } from "@/lib/notice";
import { PREFS_STORAGE_KEY } from "@/lib/preferences";
import { resetLegacyStorageMigrationForTests } from "@/lib/storage";
import { encodeSseEvent } from "@/lib/stream";

const base: Omit<TranslatorConfig, "mode" | "liveAvailability"> = {
  notice: { version: "v-test", text: "Notice text." },
  limits: { maxInputCodePoints: 3000 },
};
const cfg = (
  mode: TranslatorConfig["mode"],
  liveAvailability?: TranslatorConfig["liveAvailability"],
): TranslatorConfig => ({
  ...base,
  mode,
  liveAvailability,
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
  resetLegacyStorageMigrationForTests();
  sessionStorage.clear();
  localStorage.clear();
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
      expect(screen.getByTestId("status").textContent).toContain("Failed"),
    );
    const text = screen.getByTestId("status").textContent ?? "";
    expect(text).toContain("unavailable");
    expect(text).not.toContain("<html>");
  });
});

const enc = new TextEncoder();
const delta = (text: string) => encodeSseEvent("delta", { text });
const done = () =>
  encodeSseEvent("done", { requestId: "r", finishReason: "complete", durationMs: 1 });

function controlledStream() {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
    },
    cancel() {
      canceled = true;
    },
  });
  return {
    wasCanceled: () => canceled,
    response: new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
    push: (s: string) => {
      try {
        ctrl.enqueue(enc.encode(s));
      } catch {
        // Stream already canceled by the consumer.
      }
    },
    close: () => {
      try {
        ctrl.close();
      } catch {
        // Already closed or canceled.
      }
    },
  };
}

const textarea = () => screen.getByLabelText("Your text") as HTMLTextAreaElement;
const sourceSel = () => screen.getByLabelText("Source style") as HTMLSelectElement;
const targetSel = () => screen.getByLabelText("Target style") as HTMLSelectElement;
const btn = (name: string | RegExp) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;
const status = () => screen.getByTestId("status").textContent ?? "";
const output = () => screen.getByTestId("output").textContent ?? "";

function stubComplete(out: string) {
  const fetchMock = vi
    .fn()
    .mockImplementation(async () => sseResponse([delta(out), done()]));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function completeRun(out = "OUT") {
  const fetchMock = stubComplete(out);
  render(<Translator config={cfg("live")} />);
  await fillAndSubmit();
  await waitFor(() => expect(status()).toBe("Complete"));
  return fetchMock;
}

function stubClipboard(writeText: (s: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

describe("Translator workflow", () => {
  it("offers all five styles in labeled selectors and blocks same-pair submit", () => {
    render(<Translator config={cfg("live")} />);
    for (const sel of [sourceSel(), targetSel()]) {
      expect(Array.from(sel.options).map((o) => o.textContent)).toEqual([
        "Human",
        "LinkedIn",
        "Corporate",
        "Startup Founder",
        "Academic",
      ]);
    }
    fireEvent.change(textarea(), { target: { value: "hi" } });
    fireEvent.click(screen.getByLabelText(/I am an adult/));
    expect(translateBtn().disabled).toBe(false);
    fireEvent.change(targetSel(), { target: { value: "human" } });
    expect(translateBtn().disabled).toBe(true);
    expect(screen.getByText("Choose a different target style.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Human · Result/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Human · Source/ })).toBeTruthy();
  });

  it("disables intensity for Human target and restores it afterwards", () => {
    render(<Translator config={cfg("live")} />);
    fireEvent.change(sourceSel(), { target: { value: "corporate" } });
    fireEvent.click(screen.getByLabelText("Maximum"));
    fireEvent.change(targetSel(), { target: { value: "human" } });
    expect((screen.getByLabelText("Subtle") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Plain English keeps it direct.")).toBeTruthy();
    fireEvent.change(targetSel(), { target: { value: "startup" } });
    expect((screen.getByLabelText("Maximum") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Maximum") as HTMLInputElement).disabled).toBe(false);
  });

  it("sends the chosen styles and intensity", async () => {
    const fetchMock = stubComplete("x");
    render(<Translator config={cfg("live")} />);
    fireEvent.change(sourceSel(), { target: { value: "academic" } });
    fireEvent.change(targetSel(), { target: { value: "startup" } });
    fireEvent.click(screen.getByLabelText("Maximum"));
    fireEvent.change(textarea(), { target: { value: "hello" } });
    fireEvent.click(screen.getByLabelText(/I am an adult/));
    fireEvent.click(translateBtn());
    await waitFor(() => expect(status()).toBe("Complete"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      text: "hello",
      sourceStyle: "academic",
      targetStyle: "startup",
      intensity: "maximum",
    });
  });

  it("Swap moves a fresh complete result into the input", async () => {
    await completeRun("OUT");
    fireEvent.click(btn(/Swap/));
    expect(textarea().value).toBe("OUT");
    expect(sourceSel().value).toBe("linkedin");
    expect(targetSel().value).toBe("human");
    expect(status()).toBe("Idle");
    expect(output()).not.toContain("OUT");
  });

  it("Swap without a result keeps the input", () => {
    render(<Translator config={cfg("live")} />);
    fireEvent.change(textarea(), { target: { value: "keep me" } });
    fireEvent.click(btn(/Swap/));
    expect(textarea().value).toBe("keep me");
    expect(sourceSel().value).toBe("linkedin");
    expect(targetSel().value).toBe("human");
  });

  it("shows over-limit after Swap without truncating", async () => {
    await completeRun("b".repeat(3001));
    fireEvent.click(btn(/Swap/));
    expect(textarea().value.length).toBe(3001);
    expect(screen.getByTestId("counter").textContent).toContain("over the limit");
    expect(translateBtn().disabled).toBe(true);
  });

  it("locks controls during generation but keeps Stop enabled", async () => {
    const s = controlledStream();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(s.response));
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();
    await waitFor(() => expect(status()).toBe("Generating"));
    expect(textarea().disabled).toBe(true);
    expect(sourceSel().disabled).toBe(true);
    expect(targetSel().disabled).toBe(true);
    expect((screen.getByLabelText("Subtle") as HTMLInputElement).disabled).toBe(true);
    expect(btn(/Swap/).disabled).toBe(true);
    expect(btn("Clear").disabled).toBe(true);
    expect(btn(EXAMPLES[0].label).disabled).toBe(true);
    expect((screen.getByLabelText(/I am an adult/) as HTMLInputElement).disabled).toBe(true);
    expect(btn("Stop").disabled).toBe(false);
    s.close();
  });

  it("Clear works after a result and keeps selections", async () => {
    await completeRun("OUT");
    fireEvent.click(btn("Clear"));
    expect(textarea().value).toBe("");
    expect(status()).toBe("Idle");
    expect(targetSel().value).toBe("linkedin");
  });

  it("Stop keeps partial text as Stopped", async () => {
    const s = controlledStream();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(s.response));
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();
    s.push(delta("Par"));
    await waitFor(() => expect(output()).toBe("Par"));
    fireEvent.click(btn("Stop"));
    expect(status()).toBe("Stopped");
    expect(output()).toBe("Par");
    expect(screen.getByText(/incomplete/)).toBeTruthy();
    expect(btn("Copy result").disabled).toBe(true);
    expect(btn("Regenerate").disabled).toBe(true);
    expect(textarea().disabled).toBe(false);
  });

  it("Stop then immediate resubmit never shows old-run text", async () => {
    const first = controlledStream();
    const second = controlledStream();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(first.response)
      .mockResolvedValueOnce(second.response);
    vi.stubGlobal("fetch", fetchMock);
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();
    first.push(delta("OLD1"));
    await waitFor(() => expect(output()).toBe("OLD1"));
    fireEvent.click(btn("Stop"));
    fireEvent.click(translateBtn());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    first.push(delta("OLD2"));
    second.push(delta("NEW"));
    await waitFor(() => expect(output()).toBe("NEW"));
    await waitFor(() => expect(first.wasCanceled()).toBe(true));
    first.push(delta("OLD3") + done());
    second.push(done());
    await waitFor(() => expect(status()).toBe("Complete"));
    expect(output()).toBe("NEW");
  });

  it("Regenerate resubmits the snapshot with one new request and no prior output", async () => {
    const fetchMock = await completeRun("OUT");
    fireEvent.click(btn("Regenerate"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[1][1].body).not.toContain("OUT");
    await waitFor(() => expect(status()).toBe("Complete"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("copies the result and both texts", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    await completeRun("OUT");
    fireEvent.click(btn("Copy result"));
    await waitFor(() => expect(screen.getByTestId("copy-note").textContent).toContain("Copied"));
    expect(writeText).toHaveBeenLastCalledWith("OUT");
    fireEvent.click(btn("Copy both"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText).toHaveBeenLastCalledWith(
      "Human:\nhello there\n\nLinkedIn (Balanced):\nOUT",
    );
  });

  it("shows a useful message when the clipboard rejects", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    await completeRun("OUT");
    fireEvent.click(btn("Copy result"));
    await waitFor(() =>
      expect(screen.getByTestId("copy-note").textContent).toContain("Couldn't copy"),
    );
  });

  it("Ctrl/Cmd+Enter submits, but not during composition or while busy", async () => {
    const s = controlledStream();
    const fetchMock = vi.fn().mockResolvedValue(s.response);
    vi.stubGlobal("fetch", fetchMock);
    render(<Translator config={cfg("live")} />);
    fireEvent.change(textarea(), { target: { value: "hi" } });
    fireEvent.click(screen.getByLabelText(/I am an adult/));

    fireEvent.keyDown(textarea(), { key: "Enter", ctrlKey: true, isComposing: true });
    fireEvent.keyDown(textarea(), { key: "Enter", ctrlKey: true, keyCode: 229 });
    fireEvent.keyDown(textarea(), { key: "Enter" });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea(), { key: "Enter", metaKey: true });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(textarea(), { key: "Enter", ctrlKey: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    s.close();
  });

  it("demo example sets direction and labels the output", () => {
    render(<Translator config={cfg("demo")} />);
    const ex = EXAMPLES.find((e) => e.id === "button-linkedin-human")!;
    fireEvent.click(btn(ex.label));
    expect(sourceSel().value).toBe("linkedin");
    expect(targetSel().value).toBe("human");
    expect(textarea().value).toBe(ex.input);
    expect(status()).toContain("Example — not generated");
    expect(output()).toBe(ex.output);
    expect(screen.getByTestId("direction").textContent).toContain("LinkedIn → Human");
  });

  it("live example chip sets only the source style", () => {
    render(<Translator config={cfg("live")} />);
    const ex = EXAMPLES.find((e) => e.id === "button-linkedin-human")!;
    fireEvent.click(btn(ex.label));
    expect(sourceSel().value).toBe("linkedin");
    expect(targetSel().value).toBe("linkedin");
    expect(status()).toBe("Idle");
  });

  it("shows Blocked for a pre-stream 422 CONTENT_BLOCKED response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "CONTENT_BLOCKED", message: "Can't help with that." } }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();
    await waitFor(() => expect(status()).toContain("Blocked"));
    expect(status()).toContain("Can't help with that.");
    expect(output()).not.toContain("Can't help");
  });

  it("distinguishes Truncated from Interrupted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          delta("Half"),
          encodeSseEvent("error", {
            code: "INCOMPLETE_OUTPUT",
            message: "Hit the length limit.",
            requestId: "r",
          }),
        ]),
      ),
    );
    render(<Translator config={cfg("live")} />);
    await fillAndSubmit();
    await waitFor(() => expect(status()).toContain("Truncated"));
    expect(output()).toBe("Half");
    expect(status()).not.toContain("Interrupted");
  });

  it("labels the result stale after editing and keeps Copy available", async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    await completeRun("OUT");
    expect(screen.queryByTestId("stale")).toBeNull();
    fireEvent.change(textarea(), { target: { value: "hello there!" } });
    expect(screen.getByTestId("stale").textContent).toBe(
      "Result is from your previous input",
    );
    expect(btn("Regenerate").disabled).toBe(true);
    expect(btn("Copy result").disabled).toBe(false);
    fireEvent.click(btn(/Swap/));
    expect(textarea().value).toBe("hello there!");
  });
});

describe("Translator privacy and history", () => {
  const memoryStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      removeItem: (key: string) => {
        map.delete(key);
      },
    };
  };

  it("hides acknowledgement in demo, disabled, and region-unavailable modes", () => {
    render(<Translator config={cfg("demo")} />);
    expect(screen.queryByLabelText(/I am an adult/)).toBeNull();
    fireEvent.click(btn(EXAMPLES[0].label));
    expect(status()).toContain("Example — not generated");

    cleanup();
    render(<Translator config={cfg("disabled")} />);
    expect(screen.queryByLabelText(/I am an adult/)).toBeNull();
    fireEvent.click(btn(EXAMPLES[0].label));
    expect(status()).toContain("Example — not generated");

    cleanup();
    render(<Translator config={cfg("live", "region")} />);
    expect(screen.queryByLabelText(/I am an adult/)).toBeNull();
    fireEvent.click(btn(EXAMPLES[0].label));
    expect(status()).toContain("Example — not generated");
  });

  it("restores acknowledgement from sessionStorage only on version match", () => {
    sessionStorage.setItem("mimus:ack", "v-test");
    render(<Translator config={cfg("live", "available")} />);
    expect((screen.getByLabelText(/I am an adult/) as HTMLInputElement).checked).toBe(
      true,
    );

    cleanup();
    sessionStorage.setItem("mimus:ack", "old-version");
    render(<Translator config={cfg("live", "available")} />);
    expect((screen.getByLabelText(/I am an adult/) as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it("409 NOTICE_CHANGED clears acknowledgement and blocks resubmit", async () => {
    sessionStorage.setItem("mimus:ack", "v-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "NOTICE_CHANGED",
              message: "Notice changed.",
            },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(<Translator config={cfg("live", "available")} />);
    fireEvent.change(textarea(), { target: { value: "hello" } });
    await waitFor(() =>
      expect((screen.getByLabelText(/I am an adult/) as HTMLInputElement).checked).toBe(
        true,
      ),
    );
    fireEvent.click(translateBtn());
    await waitFor(() => expect(status()).toContain("Notice changed"));
    expect((screen.getByLabelText(/I am an adult/) as HTMLInputElement).checked).toBe(
      false,
    );
    expect(sessionStorage.getItem("mimus:ack")).toBeNull();
    expect(translateBtn().disabled).toBe(true);
    expect(screen.getByText(/Refresh the page/)).toBeTruthy();
  });

  it("shows quota exhausted message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "SERVICE_QUOTA_EXHAUSTED",
              message: "server quota",
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(<Translator config={cfg("live", "available")} />);
    await fillAndSubmit();
    await waitFor(() => expect(status()).toContain("Shared free capacity"));
  });

  it("shows HTML 429 with Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>rate limited</html>", {
          status: 429,
          headers: { "Content-Type": "text/html", "Retry-After": "30" },
        }),
      ),
    );
    render(<Translator config={cfg("live", "available")} />);
    await fillAndSubmit();
    await waitFor(() => expect(status()).toContain("Shared networks"));
    expect(status()).toContain("30 seconds");
  });

  it("history is off by default, saves complete results, loads, and clears", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    stubComplete("SAVED_OUT");
    render(<Translator config={cfg("live", "available")} />);
    expect(
      (screen.getByLabelText(/Save completed rewrites/) as HTMLInputElement).checked,
    ).toBe(false);

    await fillAndSubmit();
    await waitFor(() => expect(status()).toBe("Complete"));
    expect(storage.getItem("mimus:history:v1")).toBeNull();

    fireEvent.click(screen.getByLabelText(/Save completed rewrites/));
    fireEvent.click(translateBtn());
    await waitFor(() => expect(status()).toBe("Complete"));
    await waitFor(() =>
      expect(storage.getItem("mimus:history:v1")).toContain("SAVED_OUT"),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Load" })).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(status()).toContain("From history");
    expect(output()).toBe("SAVED_OUT");

    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
    expect(JSON.parse(storage.getItem("mimus:history:v1") ?? "[]")).toEqual(
      [],
    );

    fireEvent.click(screen.getByLabelText(/Save completed rewrites/));
    expect(JSON.parse(storage.getItem("mimus:history:v1") ?? "[]")).toEqual(
      [],
    );
  });

  it("restores preferences after mount", async () => {
    localStorage.setItem(
      "mimus:prefs:v1",
      JSON.stringify({
        sourceStyle: "academic",
        targetStyle: "startup",
        intensity: "maximum",
        rememberedIntensity: "maximum",
        historyEnabled: false,
      }),
    );
    render(<Translator config={cfg("live", "available")} />);
    await waitFor(() => expect(sourceSel().value).toBe("academic"));
    expect(targetSel().value).toBe("startup");
    expect((screen.getByLabelText("Maximum") as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("migrates legacy sessionStorage acknowledgement on mount", () => {
    sessionStorage.setItem("parlance:ack", "v-test");
    render(<Translator config={cfg("live", "available")} />);
    expect(sessionStorage.getItem("parlance:ack")).toBeNull();
    expect(sessionStorage.getItem(ACK_STORAGE_KEY)).toBe("v-test");
    expect((screen.getByLabelText(/I am an adult/) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("migrates legacy preferences without overwriting newer keys", async () => {
    localStorage.setItem(
      "parlance:prefs:v1",
      JSON.stringify({
        sourceStyle: "human",
        targetStyle: "linkedin",
        intensity: "subtle",
        rememberedIntensity: "subtle",
        historyEnabled: false,
      }),
    );
    localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({
        sourceStyle: "academic",
        targetStyle: "startup",
        intensity: "maximum",
        rememberedIntensity: "maximum",
        historyEnabled: false,
      }),
    );
    render(<Translator config={cfg("live", "available")} />);
    expect(localStorage.getItem("parlance:prefs:v1")).toBeNull();
    await waitFor(() => expect(sourceSel().value).toBe("academic"));
  });

  it("migrates valid legacy history without turning history on", async () => {
    const entry = addEntry(
      [],
      {
        text: "hello",
        sourceStyle: "human",
        targetStyle: "linkedin",
        effectiveIntensity: "balanced",
      },
      "legacy-out",
    )[0];
    localStorage.setItem(
      "parlance:history:v1",
      JSON.stringify([entry]),
    );
    render(<Translator config={cfg("live", "available")} />);
    expect(localStorage.getItem("parlance:history:v1")).toBeNull();
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toContain("legacy-out");
    expect(
      (screen.getByLabelText(/Save completed rewrites/) as HTMLInputElement)
        .checked,
    ).toBe(false);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Load" })).toBeTruthy(),
    );
  });

  it("shows a storage note without breaking translation", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
    });
    stubComplete("OK");
    render(<Translator config={cfg("live", "available")} />);
    fireEvent.change(screen.getAllByLabelText("Source style")[0], {
      target: { value: "corporate" },
    });
    await waitFor(() =>
      expect(screen.getByText(/Couldn't save to this browser/)).toBeTruthy(),
    );
    await fillAndSubmit();
    await waitFor(() => expect(status()).toBe("Complete"));
  });
});
