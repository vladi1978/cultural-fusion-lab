/**
 * Explicit compatibility between output category, mechanism, and objective.
 * Cross-domain inspiration is allowed only with a documented causal bridge.
 */

import type { EntityCategory, OutputCategory } from "../types";
import type { MechanismId } from "./types";
import { interpretProductIntent } from "./product-intent";

export interface MechanismCompatResult {
  applicable: boolean;
  needsBridge: boolean;
  reason: string;
}

/** Interest/objective tokens that justify sonic mechanisms for non-experience outputs. */
const SONIC_INTEREST =
  /\b(music|jazz|sonic|listening|audio|sound|dj|playlist|vinyl|radio|set)\b/i;

const SPATIAL_INTEREST =
  /\b(place|venue|room|space|circuit|zone|market|arcade|hospitality|travel)\b/i;

const NARRATIVE_INTEREST =
  /\b(film|cinema|story|narrative|screening|chapter|myth|anime)\b/i;

const MATERIAL_INTEREST =
  /\b(fashion|streetwear|apparel|garment|wear|textile|utility|layer)\b/i;

const HOSPITALITY_INTEREST =
  /\b(food|culinary|market|hospitality|dining|course|cafe|kitchen)\b/i;

const BRAND_INTEREST =
  /\b(brand|membership|drop|retail|platform|identity|collection)\b/i;

export function assessMechanismCompatibility(options: {
  mechanismId: MechanismId;
  output: OutputCategory;
  hingeCategory: EntityCategory | "tension";
  culturalInterest: string;
  rawObjective: string;
}): MechanismCompatResult {
  const { mechanismId, output, hingeCategory, culturalInterest, rawObjective } =
    options;
  const corpus = `${culturalInterest} ${rawObjective}`;

  // P9.209: explicit physical-product mechanism integrity
  // Only the currently implemented physical-product blueprint may
  // synthesize an explicitly requested catalog object.
  if (
    output === "product" &&
    interpretProductIntent(rawObjective).kind === "explicit" &&
    mechanismId !== "brand_drop"
  ) {
    return {
      applicable: false,
      needsBridge: false,
      reason:
        "The requested physical product requires the implemented physical-product blueprint; this mechanism cannot preserve its requested function.",
    };
  }


  // P9.89 explicit home-product constraint
  // The cultural hinge must not override the requested product category.
  if (
    output === "product" &&
    mechanismId === "material_layer" &&
    /\b(home|household|furniture|interior|homeware|table lamp|desk lamp|lamp|lighting fixture|shelf|cabinet|planter|vase|rug)\b/i.test(rawObjective) &&
    !/\b(clothing|garment|apparel|fashion product|wearable)\b/i.test(rawObjective)
  ) {
    return {
      applicable: false,
      needsBridge: false,
      reason: "material_layer rejected: requested home product is incompatible with the current apparel-specific synthesis.",
    };
  }

  // P9.199: preserve explicitly requested physical objects.
  // The current material_layer blueprint produces apparel, so it cannot
  // substitute clothing for a recognized non-apparel product.
  if (
    output === "product" &&
    mechanismId === "material_layer" &&
    interpretProductIntent(rawObjective).kind === "explicit"
  ) {
    return {
      applicable: false,
      needsBridge: false,
      reason:
        "material_layer rejected: apparel-specific synthesis cannot replace an explicitly requested physical product.",
    };
  }

  // Native category→mechanism alignment (no bridge required)
  const native = nativeFit(mechanismId, hingeCategory, output);
  if (native) {
    return {
      applicable: true,
      needsBridge: false,
      reason: `Native fit: ${mechanismId} with ${hingeCategory} hinge for ${output}.`,
    };
  }

  // Cross-domain: allow with bridge only when interest corpus supports the mechanism family
  const interestOk = interestSupportsMechanism(mechanismId, corpus);
  if (!interestOk) {
    return {
      applicable: false,
      needsBridge: false,
      reason: `${mechanismId} skipped for ${output}: interest/objective lacks support for this mechanism family (hinge=${hingeCategory}).`,
    };
  }

  // Product + experience-native mechanisms need an explicit product-form bridge
  if (output === "product" && isExperienceNative(mechanismId)) {
    return {
      applicable: true,
      needsBridge: true,
      reason: `Cross-domain: ${mechanismId} may inspire a ${output} only with a documented causal bridge to a concrete product form.`,
    };
  }

  if (output === "brand" && mechanismId === "sonic_set" && !SONIC_INTEREST.test(corpus)) {
    return {
      applicable: false,
      needsBridge: false,
      reason: "sonic_set rejected for brand without sonic interest support.",
    };
  }

  if (output === "brand" && isExperienceNative(mechanismId)) {
    return {
      applicable: true,
      needsBridge: true,
      reason: `Cross-domain: ${mechanismId} may inform brand ops only with a documented causal bridge.`,
    };
  }

  // Default: allow with bridge when interest supports
  return {
    applicable: true,
    needsBridge: true,
    reason: `Cross-domain application of ${mechanismId} to ${output}; bridge required.`,
  };
}

function nativeFit(
  mechanismId: MechanismId,
  hingeCategory: EntityCategory | "tension",
  output: OutputCategory,
): boolean {
  switch (mechanismId) {
    case "spatial_circuit":
      return hingeCategory === "places" && (output === "experience" || output === "brand");
    case "narrative_chapters":
      return hingeCategory === "film" && (output === "experience" || output === "brand");
    case "sonic_set":
      return hingeCategory === "music" && output === "experience";
    case "brand_drop":
      return hingeCategory === "brands" && (output === "brand" || output === "product");
    case "material_layer":
      return (
        hingeCategory === "fashion" && (output === "product" || output === "brand")
      );
    case "hospitality_course":
      return (
        hingeCategory === "food" &&
        (output === "experience" || output === "product")
      );
    case "tension_dual":
      return hingeCategory === "tension" && output === "experience";
    default:
      return false;
  }
}

function isExperienceNative(mechanismId: MechanismId): boolean {
  return (
    mechanismId === "spatial_circuit" ||
    mechanismId === "narrative_chapters" ||
    mechanismId === "sonic_set" ||
    mechanismId === "tension_dual" ||
    mechanismId === "hospitality_course"
  );
}

function interestSupportsMechanism(
  mechanismId: MechanismId,
  corpus: string,
): boolean {
  switch (mechanismId) {
    case "sonic_set":
      return SONIC_INTEREST.test(corpus);
    case "spatial_circuit":
      return SPATIAL_INTEREST.test(corpus);
    case "narrative_chapters":
      return NARRATIVE_INTEREST.test(corpus);
    case "material_layer":
      return MATERIAL_INTEREST.test(corpus);
    case "hospitality_course":
      return HOSPITALITY_INTEREST.test(corpus);
    case "brand_drop":
      return BRAND_INTEREST.test(corpus);
    case "tension_dual":
      return true;
    default:
      return false;
  }
}

export function formatCausalBridge(options: {
  mechanismId: MechanismId;
  output: OutputCategory;
  hingeCategory: EntityCategory | "tension";
  hingeName: string;
  observedSignal: string;
  interest: string;
  productForm?: string;
}): string {
  const {
    mechanismId,
    output,
    hingeCategory,
    hingeName,
    observedSignal,
    interest,
    productForm,
  } = options;

  if (output === "product") {
    return `Cross-domain bridge: “${hingeName}” (${hingeCategory}/${observedSignal}) supplies operating logic for a concrete ${interest} product${
      productForm ? ` (${productForm})` : ""
    }, not a substitute for the product itself. Mechanism=${mechanismId}.`;
  }
  if (output === "brand") {
    return `Cross-domain bridge: “${hingeName}” (${hingeCategory}/${observedSignal}) informs brand cadence/touchpoints for ${interest}; the deliverable remains a brand system, not a ${hingeCategory} event. Mechanism=${mechanismId}.`;
  }
  return `Causal link: “${hingeName}” (${hingeCategory}/${observedSignal}) shapes the ${output} sequence for ${interest}. Mechanism=${mechanismId}.`;
}
