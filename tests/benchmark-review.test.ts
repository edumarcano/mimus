import { describe, expect, it } from "vitest";
import type { GenerationRecord } from "../scripts/benchmark/types";
import { createReviewSet, importReviews, renderReviewHtml } from "../scripts/benchmark/review";

function generation(id: string, text = "A source passage"): GenerationRecord {
  return {
    schemaVersion: 1, kind: "generation", id, runId: "run", manifestHash: "manifest", datasetHash: "dataset", gitRevision: "revision", dirty: false,
    caseId: id, configId: "secret-model-id", promptVersion: "4", case: { id, split: "development", critical: false, text, sourceStyle: "human", targetStyle: "linkedin", intensity: "balanced", mustPreserve: [], mustNotInvent: [] },
    config: { id: "secret-model-id", model: "provider/private-model", role: "generator", reasoning: { effort: "high" }, maxOutputTokens: 2048, inputUsdPerMillion: 1, outputUsdPerMillion: 1 },
    repetition: 0, date: "2026-10-15T00:00:00.000Z", outputText: "A rewritten passage", normalizedCompletion: "complete", errorCode: null, firstContentMs: 10, durationMs: 20, usage: null, costUsd: 0.1, estimatedCostUsd: 0.1,
  };
}

describe("blind human review", () => {
  it("selects a stable seeded shuffle", () => {
    const rows = [generation("a"), generation("b"), generation("c"), generation("d")];
    expect(createReviewSet(rows, { id: "review-1", seed: 8, count: 3 })).toEqual(createReviewSet(rows, { id: "review-1", seed: 8, count: 3 }));
    expect(createReviewSet(rows, { id: "review-1", seed: 8, count: 3 }).items).toHaveLength(3);
  });

  it("renders source text inertly and hides model IDs and evaluator scores", () => {
    const source = generation("generation-secret", "</pre><script>alert('x')</script>");
    const html = renderReviewHtml(createReviewSet([source], { id: "set</script>", seed: 1, count: 1 }), [source]);
    expect(html).toContain("&lt;/pre&gt;&lt;script&gt;");
    expect(html).not.toContain("generation-secret");
    expect(html).not.toContain("private-model");
    expect(html).not.toContain("meaningPass");
    expect(html).not.toContain("set</script>");
    expect(html).toContain("set\\u003c/script\\u003e");
  });

  it("imports only complete, unique known blind IDs and restores generation mapping", () => {
    const rows = [generation("a"), generation("b")];
    const reviewSet = createReviewSet(rows, { id: "set", seed: 2, count: 2 });
    const payload = { reviewSetId: "set", reviews: reviewSet.items.map((item) => ({ blindId: item.blindId, meaning: 2, style: 1, tags: [], note: "checked" })) };
    const imported = importReviews(reviewSet, payload);
    expect(imported.map((item) => item.generationId).sort()).toEqual(["a", "b"]);
    expect(() => importReviews(reviewSet, { ...payload, reviews: [payload.reviews[0]] })).toThrow(/every item/);
    expect(() => importReviews(reviewSet, { ...payload, reviews: [payload.reviews[0], payload.reviews[0]] })).toThrow(/duplicate/);
    expect(() => importReviews(reviewSet, { ...payload, reviews: [{ ...payload.reviews[0], blindId: "unknown" }, payload.reviews[1]] })).toThrow(/unknown blind ID/);
  });
});
