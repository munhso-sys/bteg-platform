"use client";

import { ReasonToolBlock } from "./ReasonToolBlock";
import { SmartMineFrame } from "./SmartMineFrame";

export function ReasonToolClient() {
  return (
    <SmartMineFrame
      title="Reason Tool"
      description="Root-cause candidate — data_sync_jobs.metadata.root_cause_candidates, MTTR/downtime өсөлтийн fallback"
    >
      {({ data, from, to }) => (
        <ReasonToolBlock
          reasons={data?.reasons ?? []}
          from={from}
          to={to}
        />
      )}
    </SmartMineFrame>
  );
}
