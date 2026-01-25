import { scanSkills } from "./lib/registry.mjs";

let { errors } = await scanSkills({ includeFiles: false, includeSummary: false });

if (errors.length > 0) {
  // Keep output readable for CI logs.
  console.error(errors.join("\n\n"));
  process.exit(1);
}

console.log("OK: skills validated");

