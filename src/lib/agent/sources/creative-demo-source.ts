import type { CulturalEntity, EvidenceItem } from "../../types";
import type { CreativeFrame } from "../creative/types";

export function buildCreativeDemoEvidence(frame: CreativeFrame): {
  entities: CulturalEntity[];
  evidence: EvidenceItem[];
} {
  const entities: CulturalEntity[] = [];
  const evidence: EvidenceItem[] = [];

  for (const [index, domain] of frame.sourceDomains.entries()) {
    const entityId = `creative-demo-domain-${index + 1}`;
    const evidenceId = `creative-demo-evidence-${index + 1}`;

    entities.push({
      id: entityId,
      name: domain.name,
      category: "other",
      description: [
        `Origin supplied by creative interpretation: ${domain.origin}.`,
        `Proposed cultural essence: ${domain.essence}.`,
        `Proposed mechanisms: ${domain.coreMechanics.join("; ")}.`,
        "Unverified model interpretation, not a Qloo entity.",
      ].join(" "),
      affinity: 0,
      tags: [
        domain.name.toLowerCase(),
        ...domain.coreMechanics.map((mechanic) => mechanic.toLowerCase()),
      ],
    });

    evidence.push({
      id: evidenceId,
      source: "agent_hypothesis",
      label: `Unverified cultural interpretation: ${domain.name}`,
      detail:
        `Model-proposed interpretation of ${domain.name}: ` +
        `${domain.essence}. Mechanisms: ${domain.coreMechanics.join("; ")}. ` +
        "Requires independent cultural verification; not Qloo data.",
      relatedEntityIds: [entityId],
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  }

  return { entities, evidence };
}
