import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createPolicy, listPolicies } from "@/lib/db/repository";

export async function GET() {
  const policies = await listPolicies();
  return NextResponse.json(policies);
}

const schema = z.object({
  name: z.string().min(1),
  reference_code: z.string().nullable().optional(),
  approved_date: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  const body = schema.parse(await req.json());
  const policy = await createPolicy(body);
  return NextResponse.json(policy, { status: 201 });
}
