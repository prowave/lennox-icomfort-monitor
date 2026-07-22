export function firstValue(valuesJson: string): string {
  try {
    const values = JSON.parse(valuesJson) as { id: number; value: string }[];
    if (!values.length) return "—";
    if (values.length === 1) return values[0].value;
    return values.map((v) => v.value).join(", ");
  } catch {
    return "—";
  }
}
