export type DutyModuleId =
  | "inspection"
  | "policy-compliance"
  | "development"
  | "process";

export type DutyModuleApp = {
  id: DutyModuleId;
  href: `/${DutyModuleId}`;
  label: string;
  origin: string;
  entryPath: string;
};

function origin(envName: string, fallback: string) {
  return (process.env[envName] || fallback).replace(/\/$/, "");
}

export function getDutyModuleApps(): Record<DutyModuleId, DutyModuleApp> {
  return {
    inspection: {
      id: "inspection",
      href: "/inspection",
      label: "Хяналт шалгалт",
      origin: origin(
        "NEXT_PUBLIC_INSPECT_URL",
        "https://platform-inspection-center.vercel.app",
      ),
      entryPath: "/dashboard",
    },
    "policy-compliance": {
      id: "policy-compliance",
      href: "/policy-compliance",
      label: "Журмын биелэлт",
      origin: origin(
        "NEXT_PUBLIC_POLICY_URL",
        "https://platform-policy-compliance.vercel.app",
      ),
      entryPath: "/dashboard",
    },
    development: {
      id: "development",
      href: "/development",
      label: "Судалгаа хөгжүүлэлт",
      origin: origin(
        "NEXT_PUBLIC_DEVELOPMENT_URL",
        "https://platform-development-amber.vercel.app",
      ),
      entryPath: "/dashboard",
    },
    process: {
      id: "process",
      href: "/process",
      label: "Процесс",
      // Production Vercel project; override via NEXT_PUBLIC_PROCESS_URL.
      origin: origin(
        "NEXT_PUBLIC_PROCESS_URL",
        process.env.VERCEL
          ? "https://platform-process.vercel.app"
          : "http://localhost:3004",
      ),
      entryPath: "/processes",
    },
  };
}

export function embedSrc(
  app: DutyModuleApp,
  theme?: "light" | "dark",
  options?: {
    entryPath?: string;
    query?: Record<string, string>;
  },
) {
  const entry = options?.entryPath || app.entryPath;
  const url = new URL(`${app.origin}${entry}`);
  if (theme) url.searchParams.set("theme", theme);
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function isDutyRoute(pathname: string) {
  return (
    pathname === "/inspection" ||
    pathname === "/policy-compliance" ||
    pathname === "/development" ||
    pathname === "/process" ||
    pathname.startsWith("/inspection/") ||
    pathname.startsWith("/policy-compliance/") ||
    pathname.startsWith("/development/") ||
    pathname.startsWith("/process/")
  );
}
