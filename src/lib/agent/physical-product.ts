export interface PhysicalProductFunction {
  object: string;
  action: string;
  target: string;
  components: string[];
  userSteps: [string, string, string];
}

export function describePhysicalProduct(
  product: PhysicalProductFunction,
): {
  proposition: string;
  mechanics: string;
  journey: [string, string, string];
} {
  const object = product.object.trim();
  const action = product.action.trim();
  const target = product.target.trim();
  const components = product.components.map((c) => c.trim()).filter(Boolean);

  if (!object || !action || !target || components.length === 0) {
    throw new Error("Physical product requires object, action, target, and components.");
  }

  if (
    product.userSteps.length !== 3 ||
    product.userSteps.some((step) => !step.trim())
  ) {
    throw new Error("Physical product requires three concrete user steps.");
  }

  return {
    proposition: `${object} designed to ${action} ${target}.`,
    mechanics: `Physical components: ${components.join(", ")}. User function: ${action} ${target}. The product's utility is independent of its distribution or release model.`,
    journey: product.userSteps,
  };
}
