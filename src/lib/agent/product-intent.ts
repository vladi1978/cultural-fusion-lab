export interface ProductDefinition {
  object: string;
  function: string;
  components: string[];
  patterns: RegExp[];
}

export type ProductIntent =
  | ({ kind: "explicit" } & Omit<ProductDefinition, "patterns">)
  | { kind: "unspecified" };

export const PHYSICAL_PRODUCT_CATALOG: readonly ProductDefinition[] = [
  {
    object: "table lamp",
    function: "illuminate a workspace",
    components: ["base", "shade", "light source"],
    patterns: [/\b(table lamp|desk lamp|lamp)\b/i],
  },
  {
    object: "coffee brewing kit",
    function: "measure and filter coffee",
    components: ["filter holder", "measuring scoop"],
    patterns: [
      /\b(coffee brewing kit|coffee ritual product kit|coffee preparation kit)\b/i,
    ],
  },
  {
    object: "organizer tray",
    function: "hold and organize small objects",
    components: ["tray body", "raised edge"],
    patterns: [/\b(organizer tray|storage tray|catchall tray)\b/i],
  },
  {
    object: "chair",
    function: "support a seated person",
    components: ["seat", "backrest", "support structure"],
    patterns: [/\b(chair|seating chair)\b/i],
  },
  {
    object: "shelf",
    function: "hold and display household objects",
    components: ["horizontal shelf", "mounting or support structure"],
    patterns: [/\b(shelf|shelving|bookshelf)\b/i],
  },
  {
    object: "planter",
    function: "contain a plant and growing medium",
    components: ["plant container", "drainage provision"],
    patterns: [/\b(planter|plant pot)\b/i],
  },
];

export function interpretProductIntent(
  objective: string,
): ProductIntent {
  for (const definition of PHYSICAL_PRODUCT_CATALOG) {
    if (definition.patterns.some((pattern) => pattern.test(objective))) {
      return {
        kind: "explicit",
        object: definition.object,
        function: definition.function,
        components: [...definition.components],
      };
    }
  }

  return { kind: "unspecified" };
}
