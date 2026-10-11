/** Shared domain types for Cultural Fusion Lab */

export type EntityCategory =
  | "music"
  | "film"
  | "brands"
  | "places"
  | "fashion"
  | "food"
  | "other";

export type OutputCategory = "product" | "brand" | "experience";

export type EvidenceSource = "verified_api" | "agent_hypothesis" | "mock_demo";

export type LabMode = "demo" | "live";

export type LabStage =
  | "landing"
  | "explore"
  | "discovery"
  | "concepts"
  | "mutation";

export interface CulturalEntity {
  id: string;
  name: string;
  category: EntityCategory;
  description: string;
  affinity: number; // 0–1 conceptual affinity score (demo: fictional)
  tags: string[];
}

export interface EvidenceItem {
  id: string;
  source: EvidenceSource;
  label: string;
  detail: string;
  relatedEntityIds?: string[];
  createdAt: string;
}

export interface ExplorationRequest {
  creativeObjective: string;
  culturalInterest: string;
  location?: string;
  outputCategory: OutputCategory;
  mode: LabMode;
}

export interface CulturalCluster {
  category: EntityCategory;
  label: string;
  entities: CulturalEntity[];
}

export interface FusionConcept {
  id: string;
  title: string;
  positioning: string;
  outputCategory: OutputCategory;
  culturalInfluences: CulturalEntity[];
  evidenceIds: string[];
  summary: string;
  parentConceptId?: string;
  mutationNote?: string;
}

export interface MutationRequest {
  conceptId: string;
  replaceEntityId: string;
  newEntityId: string;
  mode: LabMode;
  exploration: ExplorationRequest;
  concepts: FusionConcept[];
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
}

export interface ExplorationResult {
  mode: LabMode;
  request: ExplorationRequest;
  clusters: CulturalCluster[];
  entities: CulturalEntity[];
  concepts: FusionConcept[];
  evidence: EvidenceItem[];
  generatedAt: string;
  disclaimer: string;
}

export interface MutationResult {
  mode: LabMode;
  originalConcept: FusionConcept;
  mutatedConcept: FusionConcept;
  evidence: EvidenceItem[];
  generatedAt: string;
  disclaimer: string;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: string;
}

export const ENTITY_CATEGORY_LABELS: Record<EntityCategory, string> = {
  music: "Music",
  film: "Film & TV",
  brands: "Brands",
  places: "Places",
  fashion: "Fashion",
  food: "Food & Drink",
  other: "Other",
};

export const OUTPUT_CATEGORY_LABELS: Record<OutputCategory, string> = {
  product: "Product",
  brand: "Brand",
  experience: "Experience",
};

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSource, string> = {
  verified_api: "Verified API data",
  agent_hypothesis: "Agent-generated hypothesis",
  mock_demo: "Mock demo data",
};

export const DEMO_DISCLAIMER =
  "DEMO MODE — All cultural entities, affinities, and concepts are fictional sample data for product demonstration. They are not Qloo Taste Graph insights and must not be treated as real cultural signals.";
