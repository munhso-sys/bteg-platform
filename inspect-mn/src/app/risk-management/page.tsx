"use client";

import { RiskFrame } from "@/components/risk/RiskFrame";
import { RiskDashboard } from "@/components/risk/RiskDashboard";

export default function RiskManagementPage() {
  return (
    <RiskFrame
      title="Эрсдэлийн удирдлага"
      description="Хяналт шалгалт, журмын биелэлт, судалгаа хөгжүүлэлт, ажилтны дуу хоолойн эрсдэлийг онцлох, тооцоолох, дүгнэх, засварын явцыг дэд хуудас, хавтасаар ангилна."
    >
      {({ data, loading }) => <RiskDashboard data={data} loading={loading} />}
    </RiskFrame>
  );
}
