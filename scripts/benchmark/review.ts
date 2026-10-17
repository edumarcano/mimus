import { createHash } from "node:crypto";
import {
  effectiveIntensity,
  STYLE_LABELS,
  STYLE_PROFILES,
} from "../../src/lib/styles";
import {
  FAILURE_TAGS,
  type FailureTag,
  type GenerationRecord,
  type HumanReview,
  type ReviewSet,
  type Score,
} from "./types";

function randomFromSeed(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createReviewSet(
  generations: GenerationRecord[],
  options: { id: string; seed: number; count: number },
): ReviewSet {
  if (
    !options.id.trim() ||
    !Number.isSafeInteger(options.seed) ||
    !Number.isSafeInteger(options.count) ||
    options.count < 1
  ) {
    throw new Error(
      "Review set needs a nonempty id, integer seed, and positive count",
    );
  }
  const eligible = new Map<string, GenerationRecord>();
  for (const generation of generations) {
    if (generation.normalizedCompletion !== "complete" || generation.errorCode)
      continue;
    const previous = eligible.get(generation.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(generation))
      throw new Error(`Conflicting generation records for ${generation.id}`);
    eligible.set(generation.id, generation);
  }
  const selected = [...eligible.keys()];
  if (options.count > selected.length)
    throw new Error(
      "Not enough eligible observations for the requested review count",
    );
  const random = randomFromSeed(options.seed);
  for (let index = selected.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [selected[index], selected[swap]] = [selected[swap], selected[index]];
  }
  const items = selected
    .slice(0, Math.min(options.count, selected.length))
    .map((generationId, index) => ({
      blindId: `blind-${createHash("sha256").update(`${options.id}:${options.seed}:${index}:${generationId}`).digest("hex").slice(0, 12)}`,
      generationId,
    }));
  return { schemaVersion: 1, id: options.id, items };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (char) =>
      ({
        "<": "\\u003c",
        ">": "\\u003e",
        "&": "\\u0026",
        "\u2028": "\\u2028",
        "\u2029": "\\u2029",
      })[char]!,
  );
}

export function renderReviewHtml(
  reviewSet: ReviewSet,
  generations: GenerationRecord[],
): string {
  const byId = new Map(generations.map((record) => [record.id, record]));
  const panels = reviewSet.items
    .map((item) => {
      const record = byId.get(item.generationId);
      if (!record) throw new Error(`Missing generation ${item.generationId}`);
      const c = record.case;
      const profile = STYLE_PROFILES[c.targetStyle];
      const intensity =
        c.targetStyle === "human"
          ? "Intensity does not apply."
          : profile.intensityGuidance[
              effectiveIntensity(c.targetStyle, c.intensity)
            ];
      const guidance = `<p><strong>${escapeHtml(STYLE_LABELS[c.sourceStyle])} → ${escapeHtml(STYLE_LABELS[c.targetStyle])}</strong> · ${escapeHtml(c.targetStyle === "human" ? "direct plain English" : c.intensity)}</p><details><summary>Scoring requirements</summary><p>${escapeHtml(profile.writingBehavior)} ${escapeHtml(profile.boundary)} ${escapeHtml(intensity)}</p><p>Must preserve</p><ul>${c.mustPreserve.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul><p>Must not invent</p><ul>${c.mustNotInvent.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul><p>Meaning 2: all material facts and intent preserved. Meaning 1: minor omission or distortion without changing a key fact. Meaning 0: material invention, changed commitment, contradiction, or lost key fact.</p></details>`;
      return `<fieldset data-blind-id="${escapeHtml(item.blindId)}"><legend>${escapeHtml(item.blindId)}</legend>${guidance}<p><strong>Source</strong></p><pre>${escapeHtml(record.case.text)}</pre><p><strong>Rewrite</strong></p><pre>${escapeHtml(record.outputText)}</pre><label>Meaning <select data-meaning required><option value="">Choose</option><option value="0">0 — material failure</option><option value="1">1 — minor issue</option><option value="2">2 — preserved</option></select></label> <label>Style <select data-style required><option value="">Choose</option><option value="0">0 — wrong</option><option value="1">1 — partial</option><option value="2">2 — matches</option></select></label><p>Failure tags</p>${FAILURE_TAGS.map((tag) => `<label><input type="checkbox" value="${tag}" data-tag> ${tag}</label> `).join("")}<p><label>Note (optional)<br><textarea data-note maxlength="1000"></textarea></label></p></fieldset>`;
    })
    .join("\n");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Blind Mimus review</title><style>body{font:16px system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#14323a}fieldset{margin:1.5rem 0;padding:1rem;border:1px solid #9ab}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5fafb;padding:.75rem}textarea{width:100%;min-height:4rem}label{margin-right:.6rem}</style><h1>Blind output review</h1><p>Score meaning and style independently using the rubric. Model and automated scores are hidden.</p><form id="reviews">${panels}<button type="submit">Download scoring JSON</button><output id="status" aria-live="polite"></output></form><script>(()=>{const form=document.getElementById('reviews');form.addEventListener('submit',event=>{event.preventDefault();const fields=[...form.querySelectorAll('fieldset')];if(fields.some(item=>!item.querySelector('[data-meaning]').value||!item.querySelector('[data-style]').value)){document.getElementById('status').textContent='Complete both scores for every item.';return;}const reviews=fields.map(item=>({blindId:item.dataset.blindId,meaning:Number(item.querySelector('[data-meaning]').value),style:Number(item.querySelector('[data-style]').value),tags:[...item.querySelectorAll('[data-tag]:checked')].map(tag=>tag.value),note:item.querySelector('[data-note]').value}));const blob=new Blob([JSON.stringify({reviewSetId:${safeScriptJson(reviewSet.id)},reviews},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='human-reviews.json';link.click();URL.revokeObjectURL(link.href);document.getElementById('status').textContent='Scoring JSON downloaded.';});})();</script></html>`;
}

function isScore(value: unknown): value is Score {
  return value === 0 || value === 1 || value === 2;
}

export function importReviews(
  reviewSet: ReviewSet,
  payload: unknown,
): HumanReview[] {
  if (!payload || typeof payload !== "object")
    throw new Error("Review payload must be an object");
  const candidate = payload as { reviewSetId?: unknown; reviews?: unknown };
  if (
    candidate.reviewSetId !== reviewSet.id ||
    !Array.isArray(candidate.reviews)
  )
    throw new Error("Review set ID or reviews list is invalid");
  const known = new Map(
    reviewSet.items.map((item) => [item.blindId, item.generationId]),
  );
  const seen = new Set<string>();
  const imported: HumanReview[] = [];
  for (const value of candidate.reviews) {
    if (!value || typeof value !== "object")
      throw new Error("Review entry is invalid");
    const review = value as {
      blindId?: unknown;
      meaning?: unknown;
      style?: unknown;
      tags?: unknown;
      note?: unknown;
    };
    if (typeof review.blindId !== "string" || !known.has(review.blindId))
      throw new Error("Review contains an unknown blind ID");
    if (seen.has(review.blindId))
      throw new Error("Review contains a duplicate blind ID");
    if (!isScore(review.meaning) || !isScore(review.style))
      throw new Error("Review scores must be 0, 1, or 2");
    if (
      !Array.isArray(review.tags) ||
      review.tags.some(
        (tag) =>
          typeof tag !== "string" ||
          !(FAILURE_TAGS as readonly string[]).includes(tag),
      )
    )
      throw new Error("Review tags are invalid");
    if (typeof review.note !== "string" || review.note.length > 1000)
      throw new Error("Review note is invalid");
    seen.add(review.blindId);
    imported.push({
      schemaVersion: 1,
      kind: "human",
      reviewSetId: reviewSet.id,
      generationId: known.get(review.blindId)!,
      meaning: review.meaning,
      style: review.style,
      tags: [...new Set(review.tags as FailureTag[])],
      note: review.note,
    });
  }
  if (seen.size !== known.size)
    throw new Error(
      "Review payload must score every item in the review set exactly once",
    );
  return imported;
}
