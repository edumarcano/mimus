import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { safeId } from "./manifest";
import type { LedgerEntry } from "./types";

export const ROOT = path.resolve("evals/results/raw/benchmark");
export function runDirectory(runId: string) { return path.join(ROOT, safeId(runId)); }
export function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line) as T);
}
export function append(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  const fd = openSync(file, "a");
  try { appendFileSync(fd, JSON.stringify(value) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
}
export function writeOnce(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
}
export function ledgerSpend(entries: LedgerEntry[]): number {
  const jobs = new Map<string, LedgerEntry>();
  for (const e of entries) {
    if (e.schemaVersion !== 1 || !["reservation", "settlement"].includes(e.kind) || !Number.isFinite(e.reservedUsd) || e.reservedUsd < 0 || (e.chargedUsd !== null && (!Number.isFinite(e.chargedUsd) || e.chargedUsd < 0))) throw new Error("Invalid budget ledger");
    const previous = jobs.get(e.jobId);
    if (e.kind === "reservation" && previous) throw new Error("Duplicate reservation");
    if (e.kind === "settlement" && (!previous || previous.kind !== "reservation" || e.manifestHash !== previous.manifestHash || e.reservedUsd !== previous.reservedUsd)) throw new Error("Unmatched settlement");
    jobs.set(e.jobId, e);
  }
  return [...jobs.values()].reduce((sum, e) => sum + (e.chargedUsd ?? e.reservedUsd), 0);
}
export function reserve(jobId: string, runId: string, manifestHash: string, reservedUsd: number, maxUsd: number) {
  const file = path.join(ROOT, "ledger.jsonl");
  const ledger = readJsonl<LedgerEntry>(file);
  if (ledger.some(e => e.jobId === jobId)) throw new Error("Job already dispatched; billing may be uncertain. Use a new run for an explicit rerun.");
  if (!Number.isFinite(reservedUsd) || reservedUsd < 0 || ledgerSpend(ledger) + reservedUsd > Math.min(maxUsd, 3)) throw new Error("Budget ceiling would be exceeded; request not sent");
  const entry: LedgerEntry = { schemaVersion: 1, kind: "reservation", jobId, runId, manifestHash, date: new Date().toISOString(), reservedUsd, chargedUsd: null };
  append(file, entry);
  return (chargedUsd: number | null) => append(file, { ...entry, kind: "settlement", date: new Date().toISOString(), chargedUsd });
}
