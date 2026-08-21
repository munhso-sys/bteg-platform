"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";

/** CSV / file download link that respects portal `/policy-compliance` prefix. */
export function ExportLink({
  path,
  children,
  className,
}: {
  path: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [href, setHref] = useState(path);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setHref(withBasePath(path));
    }, 0);
    return () => window.clearTimeout(id);
  }, [path]);

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
