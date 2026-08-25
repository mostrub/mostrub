import { escapeSqlLiteral } from "@/lib/filters"
import type { TableName } from "@/lib/types"

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS ingest_files (
  file_id VARCHAR,
  file_name VARCHAR,
  source_share VARCHAR,
  plant VARCHAR,
  shift VARCHAR,
  shift_date VARCHAR,
  ingested_at VARCHAR,
  byte_size BIGINT,
  cycle_count INTEGER,
  downtime_count INTEGER,
  alarm_count INTEGER,
  server_sample_count INTEGER,
  controller_count INTEGER,
  status VARCHAR,
  error_message VARCHAR
);

CREATE TABLE IF NOT EXISTS cycles (
  cycle_id VARCHAR,
  file_id VARCHAR,
  plant VARCHAR,
  line VARCHAR,
  station VARCHAR,
  machine VARCHAR,
  controller_id VARCHAR,
  work_order VARCHAR,
  sku VARCHAR,
  serial VARCHAR,
  shift VARCHAR,
  operator_id VARCHAR,
  started_at VARCHAR,
  ended_at VARCHAR,
  cycle_ms INTEGER,
  target_cycle_ms INTEGER,
  result VARCHAR,
  good_qty INTEGER,
  scrap_qty INTEGER,
  rework_qty INTEGER,
  fail_code VARCHAR,
  fail_reason VARCHAR
);

CREATE TABLE IF NOT EXISTS downtime (
  event_id VARCHAR,
  file_id VARCHAR,
  plant VARCHAR,
  line VARCHAR,
  station VARCHAR,
  machine VARCHAR,
  controller_id VARCHAR,
  started_at VARCHAR,
  ended_at VARCHAR,
  duration_ms INTEGER,
  reason_code VARCHAR,
  reason_text VARCHAR,
  category VARCHAR,
  shift VARCHAR
);

CREATE TABLE IF NOT EXISTS alarms (
  alarm_id VARCHAR,
  file_id VARCHAR,
  plant VARCHAR,
  line VARCHAR,
  station VARCHAR,
  machine VARCHAR,
  controller_id VARCHAR,
  raised_at VARCHAR,
  cleared_at VARCHAR,
  severity VARCHAR,
  code VARCHAR,
  message VARCHAR,
  ack_state VARCHAR
);

CREATE TABLE IF NOT EXISTS server_samples (
  sample_id VARCHAR,
  file_id VARCHAR,
  plant VARCHAR,
  line VARCHAR,
  server_id VARCHAR,
  server_role VARCHAR,
  sampled_at VARCHAR,
  cpu_pct DOUBLE,
  mem_pct DOUBLE,
  disk_pct DOUBLE,
  plc_scan_ms DOUBLE,
  heartbeat_ms DOUBLE,
  queue_depth INTEGER,
  missed_heartbeats INTEGER,
  session_count INTEGER,
  network_err INTEGER,
  temperature_c DOUBLE
);

CREATE TABLE IF NOT EXISTS controllers (
  controller_id VARCHAR,
  file_id VARCHAR,
  plant VARCHAR,
  line VARCHAR,
  station VARCHAR,
  machine VARCHAR,
  vendor VARCHAR,
  model VARCHAR,
  firmware VARCHAR,
  ip_address VARCHAR,
  rack INTEGER,
  slot INTEGER,
  scan_ms_avg DOUBLE,
  scan_ms_p95 DOUBLE,
  io_faults INTEGER,
  last_fault_code VARCHAR,
  last_seen VARCHAR,
  run_mode VARCHAR
);
`

export const INSERT_SQL = {
  ingest_files: `INSERT INTO ingest_files BY NAME SELECT * FROM read_json_auto('ingest_files.json')`,
  cycles: `INSERT INTO cycles BY NAME SELECT * FROM read_json_auto('cycles.json')`,
  downtime: `INSERT INTO downtime BY NAME SELECT * FROM read_json_auto('downtime.json')`,
  alarms: `INSERT INTO alarms BY NAME SELECT * FROM read_json_auto('alarms.json')`,
  server_samples: `INSERT INTO server_samples BY NAME SELECT * FROM read_json_auto('server_samples.json')`,
  controllers: `INSERT INTO controllers BY NAME SELECT * FROM read_json_auto('controllers.json')`,
} as const

export function insertParquetByName(table: TableName, path: string): string {
  return `INSERT INTO ${table} BY NAME SELECT * FROM read_parquet('${path}')`
}

export function deleteByFileIdsSql(
  table: TableName,
  fileIds: readonly string[]
): string | null {
  if (fileIds.length === 0) {
    return null
  }
  const body = fileIds
    .map((id) => `'${escapeSqlLiteral(id)}'`)
    .join(", ")
  return `DELETE FROM ${table} WHERE file_id IN (${body})`
}
