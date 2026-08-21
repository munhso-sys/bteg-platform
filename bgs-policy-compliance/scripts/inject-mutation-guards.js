/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

const files = [
  "src/app/api/policies/route.ts",
  "src/app/api/policies/[id]/route.ts",
  "src/app/api/policies/[id]/sections/route.ts",
  "src/app/api/policies/[id]/clauses/route.ts",
  "src/app/api/policies/[id]/org/route.ts",
  "src/app/api/clauses/[id]/route.ts",
  "src/app/api/positions/route.ts",
  "src/app/api/positions/[id]/route.ts",
  "src/app/api/positions/[id]/org/route.ts",
  "src/app/api/responsibilities/route.ts",
  "src/app/api/responsibilities/[id]/route.ts",
  "src/app/api/evaluations/route.ts",
  "src/app/api/job-descriptions/route.ts",
];

const importLine =
  'import { requirePolicyMutation } from "@/lib/access/scope";\n';

for (const f of files) {
  let c = fs.readFileSync(f, "utf8");
  if (!c.includes("requirePolicyMutation")) {
    c = importLine + c;
  }
  c = c.replace(
    /export async function (POST|PATCH|DELETE)\(([^)]*)\) \{\n(  try \{\n)?/g,
    (m, method, args, tryBlock) => {
      if (m.includes("requirePolicyMutation")) return m;
      if (tryBlock) {
        return (
          "export async function " +
          method +
          "(" +
          args +
          ") {\n  const gate = await requirePolicyMutation();\n  if (gate.error) return gate.error;\n  try {\n"
        );
      }
      return (
        "export async function " +
        method +
        "(" +
        args +
        ") {\n  const gate = await requirePolicyMutation();\n  if (gate.error) return gate.error;\n"
      );
    },
  );
  fs.writeFileSync(f, c);
  console.log("updated", f);
}
