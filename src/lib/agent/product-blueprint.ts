import { describePhysicalProduct } from "./physical-product";
import type { ProductIntent } from "./product-intent";

export interface ProductBlueprint {
  object: string;
  proposition: string;
  mechanics: string;
  journey: [string, string, string];
}

export function buildProductBlueprint(
  intent: ProductIntent,
): ProductBlueprint | undefined {
  if (intent.kind !== "explicit") return undefined;

  const object = intent.object.trim();
  const components = intent.components.map((part) => part.trim());
  const action = intent.function.trim();

  if (!object || !action || components.length === 0) {
    throw new Error("Explicit product intent is incomplete.");
  }

  const steps: [string, string, string] = [
    `Position or prepare the ${object} for its intended use.`,
    `Use the ${components.join(" and ")} to ${action}.`,
    `Evaluate the ${object} for functional usability and safe everyday operation.`,
  ];

  const physical = describePhysicalProduct({
    object,
    action: "enable users to",
    target: action,
    components,
    userSteps: steps,
  });

  return {
    object,
    proposition: physical.proposition,
    mechanics: physical.mechanics,
    journey: physical.journey,
  };
}
