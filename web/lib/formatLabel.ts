/**
 * The S30 reports mode/state strings in plain lowercase (e.g. "heat and
 * cool", "cooling", "circulate") - this is the device's own convention, not
 * something this app did to them. Purely presentational: title-cases each
 * word for display without touching the stored/raw value.
 */
export function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
