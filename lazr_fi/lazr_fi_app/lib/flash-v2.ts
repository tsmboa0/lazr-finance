// Re-export flash-v2 from the monorepo package via a project-relative path.
// Turbopack dev cannot resolve the file: symlink or external aliases reliably.
export * from "../../../flash-trade-examples-v2/packages/flash-v2/src/index.ts";
