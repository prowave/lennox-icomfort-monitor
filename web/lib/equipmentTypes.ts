/**
 * The S30/E30's alert `equipmentType` field is a fixed enum, not documented by
 * Lennox but reverse-engineered by the open-source lennoxs30api project:
 * https://github.com/PeteRager/lennoxs30api/blob/master/lennoxs30api/s30api_async.py
 * Values not in this table are genuinely unknown, not necessarily invalid.
 */
export const EQUIPMENT_TYPE_NAMES: Record<number, string> = {
  0: "Subnet Controller",
  16: "Furnace",
  17: "Air Handler",
  18: "Air Conditioner",
  19: "Heat Pump",
  22: "Zoning Controller",
};

export function equipmentTypeName(equipmentType: number): string | undefined {
  return EQUIPMENT_TYPE_NAMES[equipmentType];
}
