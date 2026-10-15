import { describe, expect, it } from "vitest";
import {
  buildRequestSnapshot,
  canCopy,
  canRegenerate,
  canSwapOutput,
  formatCopyBoth,
  INITIAL_TRANSLATOR_STATE,
  isStale,
  submitBlockReason,
  translatorReducer,
  type RequestSnapshot,
  type TranslatorState,
} from "@/lib/translator-state";

const liveCtx = { mode: "live" as const, maxInputCodePoints: 3000 };

function reduce(state: TranslatorState, ...actions: Parameters<typeof translatorReducer>[1][]) {
  return actions.reduce((s, a) => translatorReducer(s, a), state);
}

describe("translatorReducer", () => {
  it("captures snapshot on start and completes on done", () => {
    let state = translatorReducer(INITIAL_TRANSLATOR_STATE, {
      type: "setText",
      text: "hello",
    });
    state = translatorReducer(state, { type: "setAcknowledged", value: true });
    state = translatorReducer(state, { type: "start", runId: 1 });
    expect(state.snapshot).toEqual({
      text: "hello",
      sourceStyle: "human",
      targetStyle: "linkedin",
      effectiveIntensity: "balanced",
    });
    state = translatorReducer(state, { type: "delta", runId: 1, text: "Hi" });
    state = translatorReducer(state, { type: "done", runId: 1 });
    expect(state.status).toBe("complete");
    expect(state.output).toBe("Hi");
  });

  it("ignores stale run actions", () => {
    const base = reduce(
      { ...INITIAL_TRANSLATOR_STATE, status: "generating", runId: 2 },
      { type: "delta", runId: 1, text: "x" },
    );
    expect(base.output).toBe("");
  });

  it("stop keeps partial output as canceled", () => {
    const state = reduce(
      { ...INITIAL_TRANSLATOR_STATE, status: "generating", runId: 1, output: "part" },
      { type: "stop", runId: 1 },
    );
    expect(state.status).toBe("canceled");
    expect(state.output).toBe("part");
  });

  it("late delta and done after stop cannot extend or complete the result", () => {
    const stopped = reduce(
      { ...INITIAL_TRANSLATOR_STATE, status: "generating", runId: 1, output: "part" },
      { type: "stop", runId: 1 },
    );
    const late = reduce(
      stopped,
      { type: "delta", runId: 1, text: " late" },
      { type: "done", runId: 1 },
      { type: "streamError", runId: 1, code: "INCOMPLETE_OUTPUT", message: "x" },
    );
    expect(late.status).toBe("canceled");
    expect(late.output).toBe("part");
  });

  it("maps stream errors to blocked, truncated, and failed", () => {
    expect(
      reduce(
        { ...INITIAL_TRANSLATOR_STATE, status: "generating", runId: 1, output: "x" },
        {
          type: "streamError",
          runId: 1,
          code: "CONTENT_BLOCKED",
          message: "blocked",
        },
      ).status,
    ).toBe("blocked");

    expect(
      reduce(
        { ...INITIAL_TRANSLATOR_STATE, status: "generating", runId: 1, output: "x" },
        {
          type: "streamError",
          runId: 1,
          code: "INCOMPLETE_OUTPUT",
          message: "trunc",
        },
      ).status,
    ).toBe("truncated");

    expect(
      reduce(
        { ...INITIAL_TRANSLATOR_STATE, status: "generating", runId: 1, output: "" },
        {
          type: "streamError",
          runId: 1,
          code: "INCOMPLETE_OUTPUT",
          message: "empty",
        },
      ).status,
    ).toBe("failed");

    expect(
      reduce(
        { ...INITIAL_TRANSLATOR_STATE, status: "generating", runId: 1, output: "x" },
        {
          type: "streamError",
          runId: 1,
          code: "UPSTREAM_TIMEOUT",
          message: "timeout",
        },
      ).status,
    ).toBe("failed");
  });

  it("maps pre-stream CONTENT_BLOCKED to blocked without partial", () => {
    const state = reduce(
      { ...INITIAL_TRANSLATOR_STATE, status: "generating", runId: 1, output: "partial" },
      { type: "failure", runId: 1, code: "CONTENT_BLOCKED", message: "nope" },
    );
    expect(state.status).toBe("blocked");
    expect(state.output).toBe("");
  });

  it("interrupted keeps partial output", () => {
    const state = reduce(
      { ...INITIAL_TRANSLATOR_STATE, status: "generating", runId: 1, output: "part" },
      { type: "interrupted", runId: 1 },
    );
    expect(state.status).toBe("interrupted");
    expect(state.output).toBe("part");
  });

  it("clear resets finished results to idle", () => {
    for (const status of ["complete", "failed", "canceled", "example"] as const) {
      const cleared = translatorReducer(
        { ...INITIAL_TRANSLATOR_STATE, status, text: "x", output: "y" },
        { type: "clear" },
      );
      expect(cleared.status).toBe("idle");
      expect(cleared.text).toBe("");
      expect(cleared.output).toBe("");
    }
  });

  it("clear is blocked only while generating and retains preferences", () => {
    const busy = translatorReducer(
      { ...INITIAL_TRANSLATOR_STATE, status: "generating", text: "keep" },
      { type: "clear" },
    );
    expect(busy.text).toBe("keep");

    const cleared = translatorReducer(
      {
        ...INITIAL_TRANSLATOR_STATE,
        status: "idle",
        text: "x",
        output: "y",
        acknowledged: true,
        intensity: "maximum",
      },
      { type: "clear" },
    );
    expect(cleared.text).toBe("");
    expect(cleared.output).toBe("");
    expect(cleared.acknowledged).toBe(true);
    expect(cleared.intensity).toBe("maximum");
  });

  it("swap moves output into input when complete and fresh", () => {
    const snapshot: RequestSnapshot = {
      text: "in",
      sourceStyle: "human",
      targetStyle: "linkedin",
      effectiveIntensity: "balanced",
    };
    const state = reduce(
      {
        ...INITIAL_TRANSLATOR_STATE,
        text: "in",
        output: "out",
        status: "complete",
        snapshot,
      },
      { type: "swap" },
    );
    expect(state.sourceStyle).toBe("linkedin");
    expect(state.targetStyle).toBe("human");
    expect(state.text).toBe("out");
    expect(state.output).toBe("");
    expect(state.status).toBe("idle");
  });

  it("restores remembered intensity when leaving human target", () => {
    let state = reduce(
      INITIAL_TRANSLATOR_STATE,
      { type: "setIntensity", intensity: "maximum" },
      { type: "setTargetStyle", style: "human" },
    );
    expect(state.intensity).toBe("maximum");
    expect(state.rememberedIntensity).toBe("maximum");

    state = reduce(state, { type: "setTargetStyle", style: "corporate" });
    expect(state.intensity).toBe("maximum");
  });
});

describe("selectors", () => {
  it("submitBlockReason covers validation gates", () => {
    expect(submitBlockReason(INITIAL_TRANSLATOR_STATE, liveCtx)).toMatch(
      /Enter some text/,
    );
    expect(
      submitBlockReason(
        {
          ...INITIAL_TRANSLATOR_STATE,
          text: "hi",
          sourceStyle: "human",
          targetStyle: "human",
        },
        liveCtx,
      ),
    ).toMatch(/different target/);
  });

  it("isStale compares against snapshot effective intensity", () => {
    const state = {
      ...INITIAL_TRANSLATOR_STATE,
      text: "a",
      sourceStyle: "linkedin" as const,
      targetStyle: "human" as const,
      intensity: "maximum" as const,
      snapshot: {
        text: "a",
        sourceStyle: "linkedin" as const,
        targetStyle: "human" as const,
        effectiveIntensity: "balanced" as const,
      },
    };
    expect(isStale(state)).toBe(false);
    expect(isStale({ ...state, text: "b" })).toBe(true);
  });

  it("canRegenerate, canSwapOutput, and canCopy", () => {
    const freshComplete = {
      ...INITIAL_TRANSLATOR_STATE,
      status: "complete" as const,
      output: "ok",
      snapshot: buildRequestSnapshot({
        ...INITIAL_TRANSLATOR_STATE,
        text: "x",
      }),
      text: "x",
    };
    expect(canRegenerate(freshComplete)).toBe(true);
    expect(canSwapOutput(freshComplete)).toBe(true);
    expect(canCopy(freshComplete)).toBe(true);
    expect(canRegenerate({ ...freshComplete, text: "changed" })).toBe(false);
  });

  it("formatCopyBoth omits intensity for Human target", () => {
    const snap: RequestSnapshot = {
      text: "in",
      sourceStyle: "human",
      targetStyle: "human",
      effectiveIntensity: "balanced",
    };
    expect(formatCopyBoth(snap, "out")).toBe("Human:\nin\n\nHuman:\nout");

    const linkedinSnap: RequestSnapshot = {
      text: "in",
      sourceStyle: "human",
      targetStyle: "linkedin",
      effectiveIntensity: "maximum",
    };
    expect(formatCopyBoth(linkedinSnap, "out")).toBe(
      "Human:\nin\n\nLinkedIn (Maximum):\nout",
    );
  });
});
