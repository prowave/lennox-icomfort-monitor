export interface ZoneOperationDisplay {
  emoji: string;
  label: string;
  animated: boolean;
}

/**
 * Only "cooling", "off", and "waiting" have been observed on this system so
 * far (a heat pump in Florida summer never had reason to heat), but heating
 * is a real state this hardware supports - included for when it occurs.
 */
export function zoneOperationDisplay(tempOperation: string | null): ZoneOperationDisplay {
  switch (tempOperation) {
    case "cooling":
      return { emoji: "❄️", label: "Cooling", animated: true };
    case "heating":
      return { emoji: "🔥", label: "Heating", animated: true };
    case "waiting":
      return { emoji: "⏳", label: "Waiting to start", animated: true };
    case "off":
    case "":
    case null:
      return { emoji: "💤", label: "Idle", animated: false };
    default:
      // Never silently hide a state we don't recognize yet.
      return { emoji: "❔", label: tempOperation, animated: false };
  }
}
