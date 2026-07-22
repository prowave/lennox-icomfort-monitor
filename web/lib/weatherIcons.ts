/**
 * The S30 sources weather from AccuWeather's standard 1-44 icon code scheme
 * (undocumented by Lennox, but this numbering is publicly documented by
 * AccuWeather). Mapped to emoji for a lightweight visual accent - the text
 * description from the device is always shown alongside it, so an imprecise
 * emoji pick never misleads on its own.
 */
const ICON_EMOJI: Record<number, string> = {
  1: "☀️",
  2: "🌤️",
  3: "⛅",
  4: "🌥️",
  5: "🌥️",
  6: "☁️",
  7: "☁️",
  8: "☁️",
  11: "🌫️",
  12: "🌦️",
  13: "🌦️",
  14: "🌦️",
  15: "⛈️",
  16: "⛈️",
  17: "⛈️",
  18: "🌧️",
  19: "🌨️",
  20: "🌨️",
  21: "🌨️",
  22: "❄️",
  23: "❄️",
  24: "🧊",
  25: "🌨️",
  26: "🌧️",
  29: "🌨️",
  30: "🥵",
  31: "🥶",
  32: "💨",
  33: "🌙",
  34: "🌙",
  35: "☁️",
  36: "☁️",
  37: "🌙",
  38: "☁️",
  39: "🌧️",
  40: "🌧️",
  41: "⛈️",
  42: "⛈️",
  43: "🌨️",
  44: "🌨️",
};

export function weatherEmoji(iconId: number | null): string {
  if (iconId === null) return "🌡️";
  return ICON_EMOJI[iconId] ?? "🌡️";
}
