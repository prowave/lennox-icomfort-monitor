export interface ZoneReadingRow {
  ts: number;
  zone_id: number;
  temperature: number | null;
  temperature_c: number | null;
  humidity: number | null;
  damper: number | null;
  demand: number | null;
  system_mode: string | null;
  fan_mode: string | null;
  temp_operation: string | null;
  hum_operation: string | null;
  sp: number | null;
  sp_c: number | null;
  hsp: number | null;
  hsp_c: number | null;
  csp: number | null;
  csp_c: number | null;
  husp: number | null;
  desp: number | null;
  humidity_mode: string | null;
  start_time: number | null;
  defrost: number | null;
  aux: number | null;
  ssr: number | null;
  ventilation: number | null;
  fan: number | null;
}

export interface ZoneConfigDbRow {
  zone_id: number;
  min_csp: number | null;
  max_csp: number | null;
  min_hsp: number | null;
  max_hsp: number | null;
  schedule_id: number | null;
  updated_at: number;
}

export interface SystemReadingRow {
  ts: number;
  outdoor_temperature: number | null;
  outdoor_temperature_c: number | null;
  outdoor_temperature_status: string | null;
}

export interface AlertDbRow {
  code: number;
  equipment_type: number;
  identity_ts: string;
  timestamp_first: string;
  timestamp_last: string | null;
  timestamp_clear: string | null;
  priority: string | null;
  user_message: string | null;
  user_message_id: number | null;
  is_still_active: number;
  cleared_by: string | null;
  action: string | null;
  update_flag: number;
  notify_user: number;
  notify_dealer: number;
  clearable_by_user: number;
  clearable_by_dealer: number;
  optional_field_type: string | null;
  optional_field_data: string | null;
  count: number | null;
  raw_json: string | null;
  updated_at: number;
}

export interface EquipmentFeatureDbRow {
  equipment_id: number;
  feature_name: string;
  fid: number | null;
  format: string | null;
  unit: string | null;
  values_json: string;
  last_seen_ts: number;
}

export interface ComponentsResponse {
  zones: ZoneReadingRow[];
  zoneConfig: ZoneConfigDbRow[];
  system: SystemReadingRow | undefined;
  equipment: EquipmentFeatureDbRow[];
  poller: { lastMessageAt: number | null; connected: boolean };
}

export interface DailyCostEntry {
  date: string;
  coolingMinutes: number;
  effortMinutes: number;
  avgDemandPct: number;
  estimatedCost: number;
}

export interface EnergyResponse {
  today: DailyCostEntry;
  days: DailyCostEntry[];
  wattsRunning: number;
  ratePerKwh: number;
}

export interface AlertsResponse {
  active: AlertDbRow[];
  history: AlertDbRow[];
  infoActive: AlertDbRow[];
}

export interface HistoryPoint {
  ts: number;
  value: number | null;
}

export interface AlertScatterPoint {
  ts: number;
  code: number;
  codeLabel: string;
  equipmentType: number;
  equipmentLabel: string;
  priority: string | null;
  userMessage: string | null;
}

export interface WeatherDbRow {
  ts: number;
  city: string | null;
  state: string | null;
  temperature: number | null;
  temperature_c: number | null;
  icon_id: number | null;
  icon_description: string | null;
  cloud_coverage: number | null;
  rain_probability: number | null;
}

export type ReadingEvent =
  | { type: "zones"; ts: number }
  | { type: "system"; ts: number }
  | { type: "alerts"; ts: number }
  | { type: "equipment"; ts: number }
  | { type: "weather"; ts: number }
  | { type: "heartbeat"; ts: number; connected: boolean };
