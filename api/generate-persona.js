// Repo-root shim: Vercel serves functions from /api at the project root.
// The real implementation lives with the app in builder/api/.
export { default } from "../builder/api/generate-persona.js";
