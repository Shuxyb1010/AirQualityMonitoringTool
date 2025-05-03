import mapboxgl from "mapbox-gl";
import { AQICNMapCircles } from "./source.actions";

export interface Station {
  uid: string;
  lon: number;
  lat: number;
  name: string;
  aqi: number;
  state: string;
  parameter?: string;
  pollutants: {
    pm25?: number;
    pm10?: number;
    o3?: number;
    no2?: number;
    so2?: number;
    co?: number;
  };
}

export interface StationIQAIR {
  country: string;
  city: string;
  coordinates: number[];
  aqi: number;
}

export function toggleAirQualityLayer(
  map: mapboxgl.Map,
  show: boolean,
  stations: Station[],
  isStyleLoaded: boolean,
  onCircleClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded) return;

  if (show) {
    AQICNMapCircles(map, stations, isStyleLoaded, onCircleClick);
  } else {
    if (map.getLayer("stations-circles")) {
      map.removeLayer("stations-circles");
    }
    if (map.getSource("stations")) {
      map.removeSource("stations");
    }
  }
}

export function createThrottledMoveHandler(
  callback: () => void,
  limit: number = 1000
) {
  let lastFunc: NodeJS.Timeout | null = null;
  let lastRan = 0;

  return function () {
    const now = Date.now();
    if (!lastRan) {
      callback();
      lastRan = now;
    } else {
      if (lastFunc !== null) {
        clearTimeout(lastFunc);
      }
      lastFunc = setTimeout(() => {
        if (now - lastRan >= limit) {
          callback();
          lastRan = now;
        }
      }, limit - (now - lastRan));
    }
  };
}

export function animateCircleGrowth(map: mapboxgl.Map, layerId: string) {
  if (!map.getLayer(layerId)) {
    console.warn(`Layer '${layerId}' does not exist. Animation aborted.`);
    return;
  }

  let radius = 10;
  const interval = 50;
  const step = 1;

  const animation = setInterval(() => {
    if (!map.getLayer(layerId)) {
      console.warn(`Layer '${layerId}' was removed. Stopping animation.`);
      clearInterval(animation);
      return;
    }

    radius += step;
    if (radius >= 10) {
      clearInterval(animation);
    }
    map.setPaintProperty(layerId, "circle-radius", radius);
  }, interval);
}

export function animateCircleGrowthV2(map: mapboxgl.Map, layerId: string) {
  let radius = 0;
  const interval = 50;
  const step = 1;

  const animation = setInterval(() => {
    radius += step;
    if (radius >= 20) {
      clearInterval(animation);
    }
    map.setPaintProperty(layerId, "circle-radius", radius);
  }, interval);
}

export function animateCircleGrowthV3(map: mapboxgl.Map, layerId: string) {
  if (!map.getLayer(layerId)) {
    console.warn(`Layer ${layerId} not found - skipping animation`);
    return () => {};
  }

  let frame: number;
  const animate = () => {
    if (!map.getLayer(layerId)) {
      // Check layer exists
      cancelAnimationFrame(frame);
      return;
    }

    // Only proceed if layer exists
    const radius = 5 + Math.abs(Math.sin(Date.now() / 1000)) * 10;
    map.setPaintProperty(layerId, "circle-radius", radius);
    frame = requestAnimationFrame(animate);
  };

  frame = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(frame);
  };
}
