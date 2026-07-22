"use client";

import { useCallback, useEffect, useState } from "react";
import { useLennoxEvent } from "@/lib/useLennoxStream";
import { weatherEmoji } from "@/lib/weatherIcons";
import type { WeatherDbRow } from "@/lib/types";

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherDbRow | null>(null);

  const refetch = useCallback(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((json) => setWeather(json.weather))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useLennoxEvent((event) => {
    if (event.type === "weather") refetch();
  });

  if (!weather) {
    return (
      <div className="card p-4">
        <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
          Weather
        </div>
        <div className="mt-1" style={{ color: "var(--text-muted)" }}>
          Waiting for a weather update…
        </div>
      </div>
    );
  }

  const location = [weather.city, weather.state].filter(Boolean).join(", ");

  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="text-4xl" aria-hidden>
        {weatherEmoji(weather.icon_id)}
      </div>
      <div>
        <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
          {location || "Weather"}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {weather.temperature ?? "—"}°F
          </span>
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {weather.icon_description ?? ""}
          </span>
        </div>
        {weather.rain_probability !== null && (
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {weather.rain_probability}% chance of rain
          </div>
        )}
      </div>
    </div>
  );
}
