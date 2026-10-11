import type { ExplorationRequest, ExplorationResult, LabStage } from "./types";

const DRAFT_KEY = "cfl:draft-v1";
const RESULT_KEY = "cfl:result-v1";
const STAGE_KEY = "cfl:stage-v1";

export interface LabDraft {
  request: Partial<ExplorationRequest>;
  updatedAt: string;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveDraft(request: Partial<ExplorationRequest>): void {
  if (!canUseStorage()) return;
  const payload: LabDraft = {
    request,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

export function loadDraft(): LabDraft | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LabDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(DRAFT_KEY);
}

export function saveResult(result: ExplorationResult): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(RESULT_KEY, JSON.stringify(result));
}

export function loadResult(): ExplorationResult | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExplorationResult;
  } catch {
    return null;
  }
}

export function clearResult(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(RESULT_KEY);
}

export function saveStage(stage: LabStage): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STAGE_KEY, stage);
}

export function loadStage(): LabStage | null {
  if (!canUseStorage()) return null;
  const stage = window.localStorage.getItem(STAGE_KEY);
  if (
    stage === "landing" ||
    stage === "explore" ||
    stage === "discovery" ||
    stage === "concepts" ||
    stage === "mutation"
  ) {
    return stage;
  }
  return null;
}
