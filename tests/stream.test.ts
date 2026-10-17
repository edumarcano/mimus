import { describe, expect, it } from "vitest";
import {
  SseStreamParser,
  encodeSseEvent,
  type ParsedSseEvent,
} from "@/lib/stream";

const samplePayload = {
  meta: { requestId: "r1", promptVersion: "1", effectiveIntensity: "balanced" },
  delta: { text: "Line one\nLine two 🎉\n\nevent: done" },
  done: { requestId: "r1", finishReason: "complete", durationMs: 10 },
};

function encodeAll(): string {
  return (
    encodeSseEvent("meta", samplePayload.meta) +
    encodeSseEvent("delta", samplePayload.delta) +
    encodeSseEvent("done", samplePayload.done)
  );
}

function collect(parser: SseStreamParser, chunk: Uint8Array): ParsedSseEvent[] {
  return parser.push(chunk);
}

describe("SSE encode/parse", () => {
  it("round-trips a full frame", () => {
    const raw = encodeSseEvent("delta", { text: "hi" });
    const parser = new SseStreamParser();
    const events = collect(parser, new TextEncoder().encode(raw));
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe("delta");
  });

  it("parses split frames at every byte offset", () => {
    const raw = encodeAll();
    const bytes = new TextEncoder().encode(raw);

    for (let split = 1; split < bytes.length; split += 1) {
      const parser = new SseStreamParser();
      const first = bytes.slice(0, split);
      const second = bytes.slice(split);
      const events = [...collect(parser, first), ...collect(parser, second)];
      const end = parser.end();
      expect(end.interrupted).toBe(false);
      expect(events.map((e) => e.event)).toEqual(["meta", "delta", "done"]);
      if (events[1]?.event === "delta") {
        expect(events[1].data.text).toBe(samplePayload.delta.text);
      }
    }
  });

  it("handles multiple frames in one chunk and CRLF", () => {
    const crlf = encodeSseEvent("meta", samplePayload.meta).replace(
      /\n/g,
      "\r\n",
    );
    const parser = new SseStreamParser();
    const events = collect(parser, new TextEncoder().encode(crlf));
    expect(events).toHaveLength(1);
  });

  it("reports interrupted when no terminal event arrives", () => {
    const partial = encodeSseEvent("delta", { text: "partial" });
    const parser = new SseStreamParser();
    collect(parser, new TextEncoder().encode(partial));
    expect(parser.end().interrupted).toBe(true);
  });

  it("does not treat JSON text as injectable SSE boundaries", () => {
    const malicious = encodeSseEvent("delta", {
      text: 'hello\n\nevent: done\ndata: {"finishReason":"complete"}',
    });
    const parser = new SseStreamParser();
    const events = collect(parser, new TextEncoder().encode(malicious));
    expect(events).toHaveLength(1);
    expect(parser.end().interrupted).toBe(true);
  });
});
