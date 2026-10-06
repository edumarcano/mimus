export type SseMetaPayload = {
  requestId: string;
  promptVersion: string;
  effectiveIntensity: string;
};

export type SseDeltaPayload = {
  text: string;
};

export type SseDonePayload = {
  requestId: string;
  finishReason: "complete";
  durationMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type SseErrorPayload = {
  code: string;
  message: string;
  requestId: string;
};

export type SseEventName = "meta" | "delta" | "done" | "error";

export type ParsedSseEvent =
  | { event: "meta"; data: SseMetaPayload }
  | { event: "delta"; data: SseDeltaPayload }
  | { event: "done"; data: SseDonePayload }
  | { event: "error"; data: SseErrorPayload };

const TERMINAL_EVENTS = new Set<SseEventName>(["done", "error"]);

export function encodeSseEvent(
  event: SseEventName,
  data: unknown,
): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

type ParserState = {
  buffer: string;
  sawTerminal: boolean;
};

export class SseStreamParser {
  private readonly decoder = new TextDecoder("utf-8", { fatal: false });
  private state: ParserState = { buffer: "", sawTerminal: false };

  push(chunk: Uint8Array): ParsedSseEvent[] {
    const text = this.decoder.decode(chunk, { stream: true });
    this.state.buffer += text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return this.drainFrames();
  }

  end(): { interrupted: boolean } {
    const tail = this.decoder.decode();
    if (tail.length > 0) {
      this.state.buffer += tail.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      this.drainFrames();
    }
    return { interrupted: !this.state.sawTerminal };
  }

  private drainFrames(): ParsedSseEvent[] {
    const out: ParsedSseEvent[] = [];
    while (true) {
      const sep = this.state.buffer.indexOf("\n\n");
      if (sep === -1) {
        break;
      }
      const rawFrame = this.state.buffer.slice(0, sep);
      this.state.buffer = this.state.buffer.slice(sep + 2);
      const parsed = parseFrame(rawFrame);
      if (parsed) {
        if (TERMINAL_EVENTS.has(parsed.event)) {
          this.state.sawTerminal = true;
        }
        out.push(parsed);
      }
    }
    return out;
  }
}

function parseFrame(frame: string): ParsedSseEvent | null {
  let eventName: string | null = null;
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (!eventName || dataLines.length === 0) {
    return null;
  }

  const dataRaw = dataLines.join("\n");
  let data: unknown;
  try {
    data = JSON.parse(dataRaw);
  } catch {
    return null;
  }

  switch (eventName) {
    case "meta":
      return { event: "meta", data: data as SseMetaPayload };
    case "delta":
      return { event: "delta", data: data as SseDeltaPayload };
    case "done":
      return { event: "done", data: data as SseDonePayload };
    case "error":
      return { event: "error", data: data as SseErrorPayload };
    default:
      return null;
  }
}
