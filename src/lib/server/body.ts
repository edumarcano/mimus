import "server-only";

import { MAX_BODY_BYTES } from "../limits";

export type ReadBodyResult =
  { ok: true; text: string } | { ok: false; code: "INPUT_TOO_LARGE" | "EMPTY" };

export async function readBoundedJsonBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<ReadBodyResult> {
  if (!body) {
    return { ok: false, code: "EMPTY" };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return { ok: false, code: "INPUT_TOO_LARGE" };
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) {
    return { ok: false, code: "EMPTY" };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder("utf-8", { fatal: false }).decode(merged);
  return { ok: true, text };
}
