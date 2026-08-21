"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useEmbedHref } from "@/lib/access/use-embed-href";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/** Next Link that keeps the signed embed token across iframe navigations. */
export function EmbedLink({ href, ...rest }: Props) {
  const { withEmbed } = useEmbedHref();
  return <Link href={withEmbed(href)} {...rest} />;
}
