import { describe, expect, it } from "vitest";
import { readBoundedJsonBody } from "@/lib/server/body";

describe("readBoundedJsonBody", () => {
  it("rejects oversize chunked bodies while reading", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(9000));
        controller.enqueue(new Uint8Array(9000));
        controller.close();
      },
    });

    const result = await readBoundedJsonBody(stream, 16384);
    expect(result).toEqual({ ok: false, code: "INPUT_TOO_LARGE" });
  });
});
