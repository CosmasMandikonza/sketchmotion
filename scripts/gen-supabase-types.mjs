import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const projectId = process.env.SUPABASE_PROJECT_ID;

if (!projectId) {
  console.error(
    "SUPABASE_PROJECT_ID is required to generate src/types/supabase.ts",
  );
  process.exit(1);
}

try {
  const output = execSync(
    `npx supabase gen types typescript --project-id ${projectId}`,
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  writeFileSync("src/types/supabase.ts", output);
  console.log("Updated src/types/supabase.ts");
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown Supabase CLI failure";
  console.error(`Failed to generate Supabase types: ${message}`);
  process.exit(1);
}
