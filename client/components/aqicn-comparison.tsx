"use client";

import { CircleMinus } from "lucide-react";
import { Station } from "../lib/actions/map.actions";

export interface AQICNStation extends Station {
  details: {
    time: {
      iso: string;
    };
    iaqi: {
      [key: string]: { v: number };
    };
    forecast?: {
      daily: {
        [key: string]: Array<{
          avg: number;
          min: number;
          max: number;
        }>;
      };
    };
    city?: {
      name: string;
    };
  };
}

export const AqicnStationCard = ({
  station,
  onClear,
}: {
  station: AQICNStation;
  onClear: () => void;
}) => {
  const formatPollutantValue = (value: number | undefined, unit: string) =>
    value ? `${value.toFixed(2)}${unit}` : "N/A";

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-zinc-200 break-words whitespace-normal">
            {station.details.city?.name || station.name}
          </h3>
          <p className="text-xs text-zinc-400">
            {new Date(station.details.time.iso).toLocaleDateString()}
          </p>
        </div>
        <button onClick={onClear} className="text-zinc-400 hover:text-zinc-200">
          <CircleMinus className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="bg-zinc-800 p-3 rounded-lg">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">
            Air Quality Index
          </h4>
          <div
            className="text-2xl font-bold"
            style={{ color: getAqiColor(station.aqi) }}
          >
            {station.aqi}
          </div>
        </div>
        <div className="bg-zinc-800 p-3 rounded-lg">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Pollutants</h4>
          <div className="space-y-2">
            {" "}
            {/* Changed from grid to vertical spacing */}
            {Object.entries(station.pollutants).map(
              ([key, value]) =>
                value && (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-zinc-400 flex-1 break-words whitespace-normal">
                      {formatPollutantName(key)}
                    </span>
                    <span className="text-zinc-200 whitespace-nowrap">
                      {formatPollutantValue(value, getPollutantUnit(key))}
                    </span>
                  </div>
                )
            )}
          </div>
        </div>

        <div className="bg-zinc-800 p-3 rounded-lg">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Weather</h4>
          <div className="space-y-2">
            {" "}
            {/* Changed from grid to vertical spacing */}
            {["t", "h", "p", "w"].map(
              (key) =>
                station.details.iaqi[key] && (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-zinc-400 flex-1 break-words whitespace-normal">
                      {formatPollutantName(key)}
                    </span>
                    <span className="text-zinc-200 whitespace-nowrap">
                      {station.details.iaqi[key].v.toFixed(2)}
                      {getPollutantUnit(key)}
                    </span>
                  </div>
                )
            )}
          </div>
        </div>
        {station.details.forecast && (
          <div className="bg-zinc-800 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">
              24h Forecast
            </h4>
            <div className="space-y-2">
              {Object.entries(station.details.forecast.daily).map(
                ([pollutant, days]) => (
                  <div key={pollutant} className="text-sm">
                    <div className="text-zinc-400 font-medium">
                      {formatPollutantName(pollutant)}
                    </div>
                    {(days as any[]).slice(0, 2).map((day, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between text-zinc-300"
                      >
                        <span>Day {idx + 1}</span>
                        <span>
                          {day.avg} ({day.min}-{day.max})
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const AqicnComparisonMetrics = ({
  stationA,
  stationB,
}: {
  stationA: AQICNStation;
  stationB: AQICNStation;
}) => {
  const calculateDifference = (a: number, b: number) => ({
    absolute: (a - b).toFixed(2),
    percentage: ((Math.abs(a - b) / ((a + b) / 2)) * 100).toFixed(1),
  });

  return (
    <div className="space-y-4">
      <div className="bg-zinc-800 p-3 rounded-lg">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">
          AQI Comparison
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div
            className="text-2xl font-bold"
            style={{ color: getAqiColor(stationA.aqi) }}
          >
            {stationA.aqi}
          </div>
          <div className="flex flex-col items-center justify-center">
            <span className="text-xs text-zinc-400">Difference</span>
            <span className="text-lg">
              {calculateDifference(stationA.aqi, stationB.aqi).absolute}
            </span>
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: getAqiColor(stationB.aqi) }}
          >
            {stationB.aqi}
          </div>
        </div>
      </div>

      <div className="bg-zinc-800 p-3 rounded-lg">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">
          Pollutant Levels
        </h3>
        <div className="space-y-3">
          {Object.keys(stationA.pollutants).map((key) => {
            const valueA =
              stationA.pollutants[key as keyof typeof stationA.pollutants];
            const valueB =
              stationB.pollutants[key as keyof typeof stationB.pollutants];

            if (!valueA || !valueB) return null;

            const diff = calculateDifference(valueA, valueB);
            const isBetter = valueA < valueB;

            return (
              <div
                key={key}
                className="grid grid-cols-3 gap-4 items-center text-sm"
              >
                <div className="text-right text-zinc-300">
                  {valueA.toFixed(2)}
                  {getPollutantUnit(key)}
                </div>
                <div className="flex flex-col items-center">
                  <span
                    className={`text-xs ${
                      isBetter ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {isBetter ? "↓" : "↑"} {diff.absolute}
                  </span>
                  <span className="text-xs text-zinc-400">
                    ({diff.percentage}%)
                  </span>
                </div>
                <div className="text-left text-zinc-300">
                  {valueB.toFixed(2)}
                  {getPollutantUnit(key)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-zinc-800 p-3 rounded-lg">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">
          Health Advice
        </h3>
        <div className="text-xs text-zinc-400 space-y-1">
          <p>• {getHealthRecommendation(stationA.aqi, stationB.aqi)}</p>
        </div>
      </div>
    </div>
  );
};

// Helper functions
const formatPollutantName = (key: string) => {
  const names: { [key: string]: string } = {
    pm25: "PM₂.₅",
    pm10: "PM₁₀",
    no2: "NO₂",
    so2: "SO₂",
    o3: "O₃",
    co: "CO",
    t: "Temperature",
    h: "Humidity",
    p: "Pressure",
    w: "Wind",
  };
  return names[key.toLowerCase()] || key.toUpperCase();
};

const getPollutantUnit = (key: string) => {
  const units: { [key: string]: string } = {
    pm25: "µg/m³",
    pm10: "µg/m³",
    no2: "ppb",
    so2: "ppb",
    o3: "ppb",
    co: "ppm",
    t: "°C",
    h: "%",
    p: "hPa",
    w: "m/s",
  };
  return units[key.toLowerCase()] || "";
};

const getAqiColor = (aqi: number) => {
  if (aqi <= 50) return "#00E400";
  if (aqi <= 100) return "#FFFF00";
  if (aqi <= 150) return "#FF7E00";
  if (aqi <= 200) return "#FF0000";
  if (aqi <= 300) return "#8F3F97";
  return "#7E0023";
};

const getHealthRecommendation = (aqiA: number, aqiB: number) => {
  const maxAqi = Math.max(aqiA, aqiB);
  if (maxAqi <= 50) return "Air quality is satisfactory";
  if (maxAqi <= 100) return "Moderate air quality";
  if (maxAqi <= 150) return "Unhealthy for sensitive groups";
  if (maxAqi <= 200) return "Unhealthy - avoid prolonged exposure";
  if (maxAqi <= 300) return "Very unhealthy - limit outdoor activities";
  return "Hazardous - avoid all outdoor activities";
};
