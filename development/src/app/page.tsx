import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const theme = typeof params.theme === "string" ? params.theme : "";
  redirect(theme ? `/dashboard?theme=${encodeURIComponent(theme)}` : "/dashboard");
}
