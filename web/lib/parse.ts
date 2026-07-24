import type { LennoxMessage } from "./lennoxClient";

export interface ZoneRow {
  ts: number;
  zoneId: number;
  temperature: number | null;
  temperatureC: number | null;
  humidity: number | null;
  damper: number | null;
  demand: number | null;
  systemMode: string | null;
  fanMode: string | null;
  tempOperation: string | null;
  humOperation: string | null;
  sp: number | null;
  spC: number | null;
  hsp: number | null;
  hspC: number | null;
  csp: number | null;
  cspC: number | null;
  husp: number | null;
  desp: number | null;
  humidityMode: string | null;
  startTime: number | null;
  defrost: boolean | null;
  aux: boolean | null;
  ssr: boolean | null;
  ventilation: boolean | null;
  fan: boolean | null;
}

export interface SystemRow {
  ts: number;
  outdoorTemperature: number | null;
  outdoorTemperatureC: number | null;
  outdoorTemperatureStatus: string | null;
}

export interface OccupancyRow {
  ts: number;
  manualAway: boolean | null;
}

export interface AlertRow {
  code: number;
  equipmentType: number;
  timestampFirst: string;
  /**
   * Stable per-occurrence identity, used only for dedup (not displayed). Some
   * alert types (observed: code 105 on equipment types 17/19) arrive with a
   * blank timestampFirst on every message, so falling back to it directly
   * would collapse hundreds of distinct flapping occurrences onto one row.
   * A clear message's timestampClear equals the preceding set message's
   * timestampLast, so timestampFirst || timestampClear || timestampLast
   * correctly threads a set/clear pair to the same identity while still
   * giving each new occurrence its own.
   */
  identityTs: string;
  timestampLast: string | null;
  timestampClear: string | null;
  priority: string | null;
  userMessage: string | null;
  userMessageId: number | null;
  isStillActive: boolean;
  clearedBy: string | null;
  action: string | null;
  update: boolean;
  notifyUser: boolean;
  notifyDealer: boolean;
  clearableByUser: boolean;
  clearableByDealer: boolean;
  optionalFieldType: string | null;
  optionalFieldData: string | null;
  count: number | null;
  rawJson: string;
}

export interface EquipmentFeatureRow {
  equipmentId: number;
  featureName: string;
  fid: number | null;
  format: string | null;
  unit: string | null;
  valuesJson: string;
}

export interface NetworkInterfaceRow {
  ts: number;
  interfaceId: number;
  macAddr: string | null;
  ssid: string | null;
  ip: string | null;
  router: string | null;
  networkStatus: string | null;
  channel: number | null;
  bitRate: number | null;
  rssi: number | null;
  txByteCount: number | null;
  rxByteCount: number | null;
}

/**
 * Strips secrets the S30 broadcasts in plaintext, in place: the WiFi password
 * in `interfaces` telemetry, and the Lennox cloud bearer token/refresh token
 * in `serverAssigned.security` (a full JWT, sent even though this app only
 * ever uses the local connection and never needs it).
 */
export function redactMessage(msg: LennoxMessage): LennoxMessage {
  const interfaces = msg.Data?.interfaces;
  if (Array.isArray(interfaces)) {
    for (const iface of interfaces) {
      if (iface?.Info?.APDetails?.password !== undefined) {
        iface.Info.APDetails.password = "[redacted]";
      }
    }
  }

  const security = msg.Data?.serverAssigned?.security;
  if (security) {
    if (security.certificateToken?.encoded !== undefined) {
      security.certificateToken.encoded = "[redacted]";
    }
    if (security.certificateToken?.refreshToken) {
      security.certificateToken.refreshToken = "[redacted]";
    }
    if (security.lccToken) security.lccToken = "[redacted]";
    if (security.userToken) security.userToken = "[redacted]";
  }

  return msg;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseZones(data: Record<string, any> | undefined, ts: number): ZoneRow[] {
  const zones = data?.zones;
  if (!Array.isArray(zones)) return [];
  const rows: ZoneRow[] = [];
  for (const z of zones) {
    const s = z?.status;
    if (!s || typeof z.id !== "number") continue;
    // The S30 lists placeholder slots for zones the system supports but
    // doesn't actually have configured (status present but only
    // temperatureStatus/humidityStatus/doNotPersist, no real reading) -
    // skip them rather than storing an all-null row for a zone that isn't real.
    if (s.temperature === undefined && s.period === undefined) continue;
    const p = s.period ?? {};
    rows.push({
      ts,
      zoneId: z.id,
      temperature: s.temperature ?? null,
      temperatureC: s.temperatureC ?? null,
      humidity: s.humidity ?? null,
      damper: s.damper ?? null,
      demand: s.demand ?? null,
      systemMode: p.systemMode ?? null,
      fanMode: p.fanMode ?? null,
      tempOperation: s.tempOperation ?? null,
      humOperation: s.humOperation ?? null,
      sp: p.sp ?? null,
      spC: p.spC ?? null,
      hsp: p.hsp ?? null,
      hspC: p.hspC ?? null,
      csp: p.csp ?? null,
      cspC: p.cspC ?? null,
      husp: p.husp ?? null,
      desp: p.desp ?? null,
      humidityMode: p.humidityMode ?? null,
      startTime: p.startTime ?? null,
      defrost: s.defrost ?? null,
      aux: s.aux ?? null,
      ssr: s.ssr ?? null,
      ventilation: s.ventilation ?? null,
      fan: s.fan ?? null,
    });
  }
  return rows;
}

export interface ZoneConfigRow {
  zoneId: number;
  minCsp: number | null;
  maxCsp: number | null;
  minHsp: number | null;
  maxHsp: number | null;
  scheduleId: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseZoneConfigs(data: Record<string, any> | undefined): ZoneConfigRow[] {
  const zones = data?.zones;
  if (!Array.isArray(zones)) return [];
  const rows: ZoneConfigRow[] = [];
  for (const z of zones) {
    const c = z?.config;
    if (!c || typeof z.id !== "number") continue;
    if (c.minCsp === undefined && c.maxCsp === undefined && c.minHsp === undefined && c.maxHsp === undefined) {
      continue;
    }
    rows.push({
      zoneId: z.id,
      minCsp: c.minCsp ?? null,
      maxCsp: c.maxCsp ?? null,
      minHsp: c.minHsp ?? null,
      maxHsp: c.maxHsp ?? null,
      scheduleId: c.scheduleId ?? null,
    });
  }
  return rows;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseNetworkInterfaces(data: Record<string, any> | undefined, ts: number): NetworkInterfaceRow[] {
  const interfaces = data?.interfaces;
  if (!Array.isArray(interfaces)) return [];
  const rows: NetworkInterfaceRow[] = [];
  for (const iface of interfaces) {
    const status = iface?.Info?.status;
    if (!status || typeof iface.id !== "number") continue;
    const diagnostics = iface?.Info?.diagnostics ?? {};
    rows.push({
      ts,
      interfaceId: iface.id,
      macAddr: status.macAddr ?? null,
      ssid: status.ssid ?? null,
      ip: status.ip ?? null,
      router: status.router ?? null,
      networkStatus: status.networkStatus ?? null,
      channel: status.channel ?? null,
      bitRate: status.bitRate ?? null,
      rssi: status.rssi ?? null,
      txByteCount: diagnostics.txByteCount ?? null,
      rxByteCount: diagnostics.rxByteCount ?? null,
    });
  }
  return rows;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSystem(data: Record<string, any> | undefined, ts: number): SystemRow | null {
  const s = data?.system?.status;
  if (!s) return null;
  return {
    ts,
    outdoorTemperature: s.outdoorTemperature ?? null,
    outdoorTemperatureC: s.outdoorTemperatureC ?? null,
    outdoorTemperatureStatus: s.outdoorTemperatureStatus ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseOccupancy(data: Record<string, any> | undefined, ts: number): OccupancyRow | null {
  const occupancy = data?.occupancy;
  if (!occupancy || occupancy.manualAway === undefined) return null;
  return {
    ts,
    manualAway: !!occupancy.manualAway,
  };
}

export interface WeatherRow {
  ts: number;
  city: string | null;
  state: string | null;
  temperature: number | null;
  temperatureC: number | null;
  iconId: number | null;
  iconDescription: string | null;
  cloudCoverage: number | null;
  rainProbability: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseWeather(data: Record<string, any> | undefined, ts: number): WeatherRow | null {
  const status = data?.weather?.status;
  const current = status?.current?.[0];
  if (!status || !current) return null;
  return {
    ts,
    city: status.city ?? null,
    state: status.state ?? null,
    temperature: current.temperature ?? null,
    temperatureC: current.temperatureC ?? null,
    iconId: current.iconId ?? null,
    iconDescription: current.iconDescription ?? null,
    cloudCoverage: current.cloudCoverage ?? null,
    rainProbability: current.rainProbability ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAlerts(data: Record<string, any> | undefined): AlertRow[] {
  const active = data?.alerts?.active;
  if (!Array.isArray(active)) return [];
  const rows: AlertRow[] = [];
  for (const entry of active) {
    const a = entry?.alert;
    if (!a || typeof a.code !== "number") continue;
    const timestampFirst = a.timestampFirst ?? "";
    rows.push({
      code: a.code,
      equipmentType: a.equipmentType ?? -1,
      timestampFirst,
      identityTs: timestampFirst || a.timestampClear || a.timestampLast || "",
      timestampLast: a.timestampLast ?? null,
      timestampClear: a.timestampClear ?? null,
      priority: a.priority ?? null,
      userMessage: a.userMessage ?? null,
      userMessageId: a.userMessageID ?? null,
      isStillActive: !!a.isStillActive,
      clearedBy: a.clearedBy ?? null,
      action: a.action ?? null,
      update: !!a.update,
      notifyUser: !!a.notifyUser,
      notifyDealer: !!a.notifyDealer,
      clearableByUser: !!a.clearableByUser,
      clearableByDealer: !!a.clearableByDealer,
      optionalFieldType: a.optionalfieldType ?? null,
      optionalFieldData: a.optionalfieldData ?? null,
      count: a.count ?? null,
      rawJson: JSON.stringify(a),
    });
  }
  return rows;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEquipmentFeatures(data: Record<string, any> | undefined): EquipmentFeatureRow[] {
  const equipments = data?.equipments;
  if (!Array.isArray(equipments)) return [];
  const rows: EquipmentFeatureRow[] = [];
  for (const eq of equipments) {
    const equipmentId = eq?.id;
    const features = eq?.equipment?.features;
    if (typeof equipmentId !== "number" || !Array.isArray(features)) continue;
    for (const f of features) {
      const feature = f?.feature;
      if (!feature?.name) continue;
      rows.push({
        equipmentId,
        featureName: feature.name,
        fid: feature.fid ?? null,
        format: feature.format ?? null,
        unit: feature.unit ?? null,
        valuesJson: JSON.stringify(feature.values ?? []),
      });
    }
  }
  return rows;
}
