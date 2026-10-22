/**
 * Objective-first creative reasoning contracts.
 *
 * Stage 1 (this file's consumer: frame.ts) turns the user's objective into a
 * CreativeFrame BEFORE any Qloo call. The frame, not entity categories, decides
 * what kind of thing gets designed. Qloo evidence later calibrates and grounds
 * the design; it never chooses the concept's form.
 */

import type { QlooEntityType } from "../../qloo/schemas";

export interface SourceDomain {
  /** e.g. "Shinrin-yoku (forest bathing)" */
  name: string;
  /** Where it comes from, e.g. "Japan" */
  origin: string;
  /** One sentence: what this practice is actually for. */
  essence: string;
  /** Concrete, transferable operating mechanics of the practice. */
  coreMechanics: string[];
}

export interface EvidenceProbe {
  /** Query sent to Qloo Search — derived from a domain, never the raw objective. */
  query: string;
  entityType: QlooEntityType;
  /** Which domain/goal this probe is meant to ground. */
  why: string;
}

export interface CreativeFrame {
  sourceDomains: SourceDomain[];
  /** Verb-led outcomes the person should experience or achieve. */
  experientialGoals: string[];
  /** Hard requirements stated or clearly implied by the objective. */
  requirements: string[];
  /** Results that would be off-brief even if internally coherent. */
  offBrief: string[];
  evidenceProbes: EvidenceProbe[];
}

export class CreativeFrameError extends Error {
  constructor(message: string, readonly raw?: string) {
    super(message);
    this.name = "CreativeFrameError";
  }
}
