import { createSmartMineDataClient } from "./client";
import { getSmartMineOrganizationId } from "./env";
import { asRows } from "./numbers";
import type { DateRange } from "./range";

const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;

type FetchTableOptions = {
  table: string;
  dateField: string;
  range: DateRange;
  timestampEnd?: boolean;
};

function applyDateFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  dateField: string,
  range: DateRange,
  timestampEnd: boolean,
) {
  let next = query.gte(dateField, range.from);
  const lteValue = timestampEnd ? `${range.to}T23:59:59.999Z` : range.to;
  next = next.lte(dateField, lteValue);
  return next;
}

async function fetchPaged(
  options: FetchTableOptions,
  withOrg: boolean,
  organizationId: string,
): Promise<{ rows: Array<Record<string, unknown>>; error: string | null }> {
  const supabase = createSmartMineDataClient();
  const rows: Array<Record<string, unknown>> = [];
  let from = 0;
  let lastError: string | null = null;

  while (from < MAX_ROWS) {
    const run = async (ordered: boolean) => {
      let query = supabase.from(options.table).select("*");
      if (withOrg) query = query.eq("organization_id", organizationId);
      query = applyDateFilter(
        query,
        options.dateField,
        options.range,
        options.timestampEnd === true,
      );
      if (ordered) {
        query = query.order(options.dateField, { ascending: false });
      }
      return query.range(from, from + PAGE_SIZE - 1);
    };

    let { data, error } = await run(true);
    if (error) {
      const retry = await run(false);
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      lastError = error.message;
      break;
    }
    const page = asRows(data);
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return { rows, error: null };
    }
    from += PAGE_SIZE;
  }

  if (rows.length > 0 && lastError) {
    return { rows, error: null };
  }
  return { rows, error: lastError };
}

async function fetchTable(options: FetchTableOptions) {
  const organizationId = getSmartMineOrganizationId();
  const primary = await fetchPaged(options, true, organizationId);
  if (!primary.error) return primary.rows;

  const fallback = await fetchPaged(options, false, organizationId);
  if (!fallback.error) return fallback.rows;

  throw new Error(
    `${options.table}: ${fallback.error ?? primary.error ?? "query failed"}`,
  );
}

export async function fetchProcessingRows(range: DateRange) {
  return fetchTable({
    table: "v_processing_dashboard",
    dateField: "production_date",
    range,
  });
}

export async function fetchEquipmentOperationRows(range: DateRange) {
  return fetchTable({
    table: "v_smartmine_equipment_operation_summary",
    dateField: "work_date",
    range,
  });
}

export async function fetchMaintenanceRows(range: DateRange) {
  return fetchTable({
    table: "v_maintenance_work_order_dashboard",
    dateField: "day_date",
    range,
  });
}

export async function fetchSyncRows(range: DateRange) {
  return fetchTable({
    table: "data_sync_jobs",
    dateField: "started_at",
    range,
    timestampEnd: true,
  });
}
