import { PlansSubnav } from "@/components/plans/PlansSubnav";

export default function PlansLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <PlansSubnav />
      {children}
    </div>
  );
}
