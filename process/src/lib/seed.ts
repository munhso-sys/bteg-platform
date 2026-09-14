import type {
  ProcessLevel,
  ProcessModuleDb,
  ProcessNode,
  ProcessNodeStatus,
} from "@/lib/types";
import { nowIso } from "@/lib/cn";

function node(
  partial: Omit<ProcessNode, "created_at" | "updated_at"> & {
    created_at?: string;
    updated_at?: string;
  },
): ProcessNode {
  const t = nowIso();
  return {
    ...partial,
    created_at: partial.created_at ?? t,
    updated_at: partial.updated_at ?? t,
  };
}

/** Demo mining PFD tree + sample cross-module links for local UI. */
export function buildSeedDb(): ProcessModuleDb {
  const l1 = node({
    id: "proc_l1_mine",
    code: "ACT-MINE-00",
    title: "Уул уурхайн үйл ажиллагаа",
    description: "Макро түвшний уурхайн үндсэн процесс",
    level: "L1_MACRO",
    parent_id: null,
    location_id: null,
    asset_id: null,
    status: "ACTIVE",
    sort_order: 1,
  });

  const l2Haul = node({
    id: "proc_l2_haul",
    code: "ACT-MINE-HAUL",
    title: "Тээвэрлэлт (Haulage)",
    description: "Ачаа тээвэр, зам, ачих/буулгах урсгал",
    level: "L2_SUBPROCESS",
    parent_id: l1.id,
    location_id: "loc_pit_a",
    asset_id: null,
    status: "ACTIVE",
    sort_order: 1,
  });

  const l2Drill = node({
    id: "proc_l2_drill",
    code: "ACT-MINE-DRILL",
    title: "Өрөмдлөг, тэсэлгээ",
    description: "Drill & blast subprocess",
    level: "L2_SUBPROCESS",
    parent_id: l1.id,
    location_id: "loc_pit_a",
    asset_id: null,
    status: "ACTIVE",
    sort_order: 2,
  });

  const l3Load = node({
    id: "proc_l3_load",
    code: "ACT-MINE-01",
    title: "Ачих (Truck Loading)",
    description: "Экскаватор → самосвал ачих үйл ажиллагаа",
    level: "L3_ACTIVITY",
    parent_id: l2Haul.id,
    location_id: "loc_face_12",
    asset_id: null,
    status: "ACTIVE",
    sort_order: 1,
  });

  const l3Dump = node({
    id: "proc_l3_dump",
    code: "ACT-MINE-02",
    title: "Буулгах (Dumping)",
    description: "Агуулга/хаягдал буулгах цэг",
    level: "L3_ACTIVITY",
    parent_id: l2Haul.id,
    location_id: "loc_dump_1",
    asset_id: null,
    status: "ACTIVE",
    sort_order: 2,
  });

  const l4Exc = node({
    id: "proc_l4_exc",
    code: "ACT-MINE-01-T1",
    title: "Экскаватор ачих",
    description: "Excavator loading cycle",
    level: "L4_TASK",
    parent_id: l3Load.id,
    location_id: "loc_face_12",
    asset_id: "asset_exc_01",
    status: "ACTIVE",
    sort_order: 1,
  });

  const l4Spot = node({
    id: "proc_l4_spot",
    code: "ACT-MINE-01-T2",
    title: "Самосвал байрлуулах",
    description: "Truck spotting under bucket",
    level: "L4_TASK",
    parent_id: l3Load.id,
    location_id: "loc_face_12",
    asset_id: "asset_truck_12",
    status: "ACTIVE",
    sort_order: 2,
  });

  const nodes: ProcessNode[] = [
    l1,
    l2Haul,
    l2Drill,
    l3Load,
    l3Dump,
    l4Exc,
    l4Spot,
  ];

  return {
    version: 2,
    nodes,
    raci_links: [
      {
        id: "raci_1",
        process_id: l4Exc.id,
        source: "policy",
        source_id: "clause_demo_load",
        title: "Ачих аюулгүй ажиллагааны журам §3.2",
        responsible_role: "Оператор",
        accountable_role: "Шифтийн менежер",
        consulted_role: "Аюулгүй ажиллагаа",
        informed_role: "Диспетчер",
      },
      {
        id: "raci_2",
        process_id: l3Load.id,
        source: "manual",
        source_id: "manual_load_raci",
        title: "Loading activity RACI",
        responsible_role: "Экскаватор оператор",
        accountable_role: "Уурхайн дарга",
        consulted_role: "Засвар үйлчилгээ",
        informed_role: "Планинг",
      },
    ],
    inspection_links: [
      {
        id: "insp_1",
        process_id: l4Exc.id,
        checklist_name: "Экскаватор өдөр тутмын шалгалт",
        run_id: "run_demo_1",
        completed_at: "2026-09-10T08:00:00.000Z",
        pass_rate: 92,
        status: "completed",
      },
      {
        id: "insp_2",
        process_id: l3Load.id,
        checklist_name: "Ачих бүсийн аюулгүй байдал",
        run_id: "run_demo_2",
        completed_at: "2026-09-12T14:30:00.000Z",
        pass_rate: 78,
        status: "completed",
      },
    ],
    issue_links: [
      {
        id: "iss_1",
        process_id: l4Spot.id,
        title: "Spotting зай хэтэрхий ойр",
        status: "open",
        severity: "high",
        root_cause_category: "HUMAN_ERROR",
        root_cause_description: "Оператор сургалт дутуу / 5-Why: дохио алга",
        created_at: "2026-09-11T09:00:00.000Z",
      },
      {
        id: "iss_2",
        process_id: l4Exc.id,
        title: "Bucket interlock алдаа",
        status: "in_progress",
        severity: "critical",
        root_cause_category: "EQUIPMENT_FAILURE",
        root_cause_description: "Датчикийн калибр алдагдсан",
        created_at: "2026-09-08T11:20:00.000Z",
      },
    ],
    risk_links: [
      {
        id: "risk_1",
        process_id: l3Load.id,
        title: "Ачих бүсийн мөргөлдөх эрсдэл",
        score: 16,
        level: "high",
        updated_at: "2026-09-13T00:00:00.000Z",
      },
      {
        id: "risk_2",
        process_id: l2Drill.id,
        title: "Тэсэлгээний бүсийн хяналт",
        score: 9,
        level: "medium",
        updated_at: "2026-09-13T00:00:00.000Z",
      },
    ],
    employee_report_links: [
      {
        id: "evr_1",
        process_id: l4Spot.id,
        title: "Дохиочин байхгүй үед ачилт хийгдэж байна",
        category: "safety",
        status: "open",
        created_at: "2026-09-12T06:45:00.000Z",
      },
    ],
    files: [],
    dfd_nodes: [],
    matrix_rows: [],
    matrix_docs: [],
    audit: [],
    updated_at: nowIso(),
  };
}

export function emptyDb(): ProcessModuleDb {
  return {
    version: 2,
    nodes: [],
    raci_links: [],
    inspection_links: [],
    issue_links: [],
    risk_links: [],
    employee_report_links: [],
    files: [],
    dfd_nodes: [],
    matrix_rows: [],
    matrix_docs: [],
    audit: [],
    updated_at: nowIso(),
  };
}

export function isProcessLevel(v: string): v is ProcessLevel {
  return (
    v === "L1_MACRO" ||
    v === "L2_SUBPROCESS" ||
    v === "L3_ACTIVITY" ||
    v === "L4_TASK"
  );
}

export function isProcessStatus(v: string): v is ProcessNodeStatus {
  return v === "ACTIVE" || v === "DRAFT" || v === "ARCHIVED";
}
