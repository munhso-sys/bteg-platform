import { redirect } from "next/navigation";

export default function OrgPoliciesRedirect() {
  redirect("/settings/org-templates");
}
