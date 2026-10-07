import { countCodePoints } from "./limits";
import {
  effectiveIntensity,
  INTENSITY_LABELS,
  isDistinctPair,
  STYLE_LABELS,
  type Intensity,
  type StyleId,
} from "./styles";

export type TranslatorStatus =
  | "idle"
  | "generating"
  | "complete"
  | "canceled"
  | "blocked"
  | "truncated"
  | "interrupted"
  | "failed"
  | "example";

export type RequestSnapshot = {
  text: string;
  sourceStyle: StyleId;
  targetStyle: StyleId;
  effectiveIntensity: Intensity;
};

export type TranslatorState = {
  text: string;
  sourceStyle: StyleId;
  targetStyle: StyleId;
  intensity: Intensity;
  rememberedIntensity: Intensity;
  acknowledged: boolean;
  status: TranslatorStatus;
  output: string;
  message: string;
  runId: number;
  snapshot: RequestSnapshot | null;
};

export type SubmitContext = {
  mode: "demo" | "live" | "disabled";
  maxInputCodePoints: number;
};

export type TranslatorAction =
  | { type: "setText"; text: string }
  | { type: "setSourceStyle"; style: StyleId }
  | { type: "setTargetStyle"; style: StyleId }
  | { type: "setIntensity"; intensity: Intensity }
  | { type: "setAcknowledged"; value: boolean }
  | {
      type: "example";
      input: string;
      showOutput: boolean;
      output?: string;
    }
  | { type: "start"; runId: number }
  | { type: "delta"; runId: number; text: string }
  | { type: "done"; runId: number }
  | { type: "stop"; runId: number }
  | {
      type: "streamError";
      runId: number;
      code: string;
      message: string;
    }
  | { type: "interrupted"; runId: number }
  | { type: "failure"; runId: number; message: string; code?: string }
  | { type: "clear" }
  | { type: "swap" };

export const INITIAL_TRANSLATOR_STATE: TranslatorState = {
  text: "",
  sourceStyle: "human",
  targetStyle: "linkedin",
  intensity: "balanced",
  rememberedIntensity: "balanced",
  acknowledged: false,
  status: "idle",
  output: "",
  message: "",
  runId: 0,
  snapshot: null,
};

export function buildRequestSnapshot(state: TranslatorState): RequestSnapshot {
  return {
    text: state.text,
    sourceStyle: state.sourceStyle,
    targetStyle: state.targetStyle,
    effectiveIntensity: effectiveIntensity(state.targetStyle, state.intensity),
  };
}

function isBusy(status: TranslatorStatus): boolean {
  return status === "generating";
}

export function isStale(state: TranslatorState): boolean {
  if (!state.snapshot) {
    return false;
  }
  const current = buildRequestSnapshot(state);
  return (
    current.text !== state.snapshot.text ||
    current.sourceStyle !== state.snapshot.sourceStyle ||
    current.targetStyle !== state.snapshot.targetStyle ||
    current.effectiveIntensity !== state.snapshot.effectiveIntensity
  );
}

export function submitBlockReason(
  state: TranslatorState,
  ctx: SubmitContext,
): string {
  if (ctx.mode === "demo") {
    return "Translate is off in demo mode. Choose an example to see a sample.";
  }
  if (ctx.mode === "disabled") {
    return "Translation is currently unavailable.";
  }
  if (isBusy(state.status)) {
    return "A rewrite is in progress.";
  }
  if (state.text.trim().length === 0) {
    return "Enter some text to translate.";
  }
  if (countCodePoints(state.text) > ctx.maxInputCodePoints) {
    return `Shorten your text to ${ctx.maxInputCodePoints.toLocaleString("en-US")} characters or fewer.`;
  }
  if (!isDistinctPair(state.sourceStyle, state.targetStyle)) {
    return "Choose a different target style.";
  }
  if (!state.acknowledged) {
    return "Acknowledge the notice to translate.";
  }
  return "";
}

export function canRegenerate(state: TranslatorState): boolean {
  return (
    state.status === "complete" &&
    !isStale(state) &&
    !isBusy(state.status)
  );
}

export function canSwapOutput(state: TranslatorState): boolean {
  return state.status === "complete" && !isStale(state);
}

export function canCopy(state: TranslatorState): boolean {
  return state.status === "complete" && state.output.length > 0;
}

export function formatCopyBoth(
  snapshot: RequestSnapshot,
  output: string,
): string {
  const sourceHeader = `${STYLE_LABELS[snapshot.sourceStyle]}:`;
  const targetHeader =
    snapshot.targetStyle === "human"
      ? `${STYLE_LABELS.human}:`
      : `${STYLE_LABELS[snapshot.targetStyle]} (${INTENSITY_LABELS[snapshot.effectiveIntensity]}):`;
  return `${sourceHeader}\n${snapshot.text}\n\n${targetHeader}\n${output}`;
}

function applyTargetStyleChange(
  state: TranslatorState,
  nextTarget: StyleId,
): Pick<TranslatorState, "targetStyle" | "intensity" | "rememberedIntensity"> {
  const leavingHuman =
    state.targetStyle === "human" && nextTarget !== "human";
  const enteringHuman = nextTarget === "human" && state.targetStyle !== "human";

  if (enteringHuman) {
    const remembered =
      state.targetStyle === "human" ? state.rememberedIntensity : state.intensity;
    return {
      targetStyle: nextTarget,
      intensity: state.intensity,
      rememberedIntensity: remembered,
    };
  }
  if (leavingHuman) {
    return {
      targetStyle: nextTarget,
      intensity: state.rememberedIntensity,
      rememberedIntensity: state.rememberedIntensity,
    };
  }
  return {
    targetStyle: nextTarget,
    intensity: state.intensity,
    rememberedIntensity: state.rememberedIntensity,
  };
}

function isRunAction(
  action: TranslatorAction,
): action is Extract<
  TranslatorAction,
  { runId: number }
> {
  return "runId" in action;
}

export function translatorReducer(
  state: TranslatorState,
  action: TranslatorAction,
): TranslatorState {
  switch (action.type) {
    case "setText":
      return { ...state, text: action.text };
    case "setSourceStyle":
      return { ...state, sourceStyle: action.style };
    case "setTargetStyle":
      return {
        ...state,
        ...applyTargetStyleChange(state, action.style),
      };
    case "setIntensity": {
      const next = action.intensity;
      return {
        ...state,
        intensity: next,
        rememberedIntensity: next,
      };
    }
    case "setAcknowledged":
      return { ...state, acknowledged: action.value };
    case "example":
      return {
        ...state,
        text: action.input,
        output: action.showOutput ? (action.output ?? "") : "",
        status: action.showOutput ? "example" : "idle",
        message: "",
        snapshot: null,
      };
    case "start":
      return {
        ...state,
        runId: action.runId,
        status: "generating",
        output: "",
        message: "",
        snapshot: buildRequestSnapshot(state),
      };
    case "clear":
      if (isBusy(state.status)) {
        return state;
      }
      return {
        ...state,
        text: "",
        status: "idle",
        output: "",
        message: "",
        snapshot: null,
      };
    case "swap": {
      const moveOutput = canSwapOutput(state);
      const nextSource = state.targetStyle;
      const nextTarget = state.sourceStyle;
      return {
        ...state,
        sourceStyle: nextSource,
        ...applyTargetStyleChange(state, nextTarget),
        text: moveOutput ? state.output : state.text,
        output: "",
        status: "idle",
        message: "",
        snapshot: null,
      };
    }
    default:
      break;
  }

  if (!isRunAction(action)) {
    return state;
  }

  if (action.runId !== state.runId) {
    return state;
  }

  if (action.type === "stop") {
    if (state.status !== "generating") {
      return state;
    }
    return {
      ...state,
      status: "canceled",
      message: "Translation stopped.",
    };
  }

  if (state.status !== "generating") {
    return state;
  }

  switch (action.type) {
    case "delta":
      return { ...state, output: state.output + action.text };
    case "done":
      return { ...state, status: "complete", message: "" };
    case "streamError":
      if (action.code === "CONTENT_BLOCKED") {
        return {
          ...state,
          status: "blocked",
          output: "",
          message: action.message,
        };
      }
      if (action.code === "INCOMPLETE_OUTPUT") {
        if (state.output.length > 0) {
          return {
            ...state,
            status: "truncated",
            message: action.message,
          };
        }
        return {
          ...state,
          status: "failed",
          output: "",
          message: action.message,
        };
      }
      return {
        ...state,
        status: "failed",
        message: action.message,
      };
    case "interrupted":
      return {
        ...state,
        status: "interrupted",
        message: "The connection ended before the rewrite finished.",
      };
    case "failure":
      if (action.code === "CONTENT_BLOCKED") {
        return {
          ...state,
          status: "blocked",
          output: "",
          message: action.message,
        };
      }
      return {
        ...state,
        status: "failed",
        message: action.message,
      };
    default:
      return state;
  }
}
