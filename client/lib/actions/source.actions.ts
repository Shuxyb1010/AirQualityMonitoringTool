import mapboxgl from "mapbox-gl";
import {
  animateCircleGrowth,
  animateCircleGrowthV2,
  animateCircleGrowthV3,
  Station,
  StationIQAIR,
} from "./map.actions";
import * as turf from "@turf/turf";
import { OpenAQParameterId, type OpenAQPollutant } from "../../constants";
import * as GeoJSON from "geojson";
import { AQICNStation } from "../../components/aqicn-comparison";

export async function fetchAQICNData(bounds: {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
}): Promise<Station[]> {
  try {
    const { lat1, lng1, lat2, lng2 } = bounds;
    const latlng = `${lat1.toFixed(4)},${lng1.toFixed(4)},${lat2.toFixed(
      4
    )},${lng2.toFixed(4)}`;

    const apiUrl = `https://api.waqi.info/v2/map/bounds?latlng=${latlng}&networks=all&token=${process.env.NEXT_PUBLIC_AQICN_API_KEY}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error("Error response from server:", await response.text());
      return [];
    }

    const data = await response.json();
    console.log("Fetched AQI data:", data);

    if (data && data.data) {
      // In your fetchAQICNData function
      return data.data.map((station: any) => ({
        uid: station.uid.toString(),
        lon: station.lon,
        lat: station.lat,
        name: station.station?.name || "Unknown Station",
        aqi: parseInt(station.aqi, 10) || 0,
        state: "active",
        parameter: "AQI",
        pollutants: {
          pm25: station.iaqi?.pm25?.v,
          pm10: station.iaqi?.pm10?.v,
          o3: station.iaqi?.o3?.v,
          no2: station.iaqi?.no2?.v,
          so2: station.iaqi?.so2?.v,
          co: station.iaqi?.co?.v,
        },
        details: station,
      }));
    }

    console.error("No data available in the response.");
    return [];
  } catch (error) {
    console.error("Failed to fetch AQI data:", error);
    return [];
  }
}

export function AQICNMap3D(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  onCircleClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded) return;

  /**
   * 1. Convert station points into small polygons (circles)
   *    so we can extrude them.
   */
  const features = stations.map((station) => {
    // Create a circular polygon around the station location.
    // The radius here is in kilometers; adjust as necessary.
    // Increase 'steps' for a smoother circle.
    const circlePolygon = turf.circle([station.lon, station.lat], 0.2, {
      steps: 32,
      units: "kilometers",
    });

    // Attach properties you want to use later (e.g. AQI, station name).
    circlePolygon.properties = {
      name: station.name,
      aqi: station.aqi,
      uid: station.uid,
    };

    return circlePolygon;
  });

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
    type: "FeatureCollection",
    features,
  };

  // 2. Add (or update) a GeoJSON source with your polygon data.
  if (map.getSource("stations")) {
    (map.getSource("stations") as mapboxgl.GeoJSONSource).setData(geojson);
  } else {
    map.addSource("stations", {
      type: "geojson",
      data: geojson,
    });

    /**
     * 3. Add a fill-extrusion layer to visualize these polygons in 3D.
     */
    map.addLayer({
      id: "stations-extrusions",
      type: "fill-extrusion",
      source: "stations",
      paint: {
        // Color based on AQI (same idea as your circle-color).
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "aqi"],
          50,
          "#00FF00",
          100,
          "#FFFF00",
          150,
          "#FFA500",
          200,
          "#FF0000",
        ],

        // Extrusion height based on AQI. Adjust the numbers as needed.
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["get", "aqi"],

          0,
          1500, // Even AQI 0 gets a high extrusion
          50,
          2000, // Low AQI
          100,
          3000, // Medium AQI
          150,
          5000, // High AQI
          200,
          5000, // Very high AQI
        ],

        "fill-extrusion-opacity": 0.8,
        "fill-extrusion-vertical-gradient": true,
      },
    });

    /**
     * 4. Optional: Show a popup on click, referencing properties from the feature.
     */
    if (onCircleClick) {
      map.on("click", "stations-extrusions", async (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const coordinates = (feature.geometry as GeoJSON.Polygon)
            .coordinates[0][0] as [number, number];
          const { name, uid } = feature.properties as {
            name: string;
            uid: number;
          };

          const formatPollutantName = (key: string) => {
            const names: { [key: string]: string } = {
              pm25: "PM₂.₅",
              pm10: "PM₁₀",
              no2: "NO₂",
              so2: "SO₂",
              o3: "O₃",
              co: "CO",
              t: "Temp",
              h: "Humid",
              p: "Press",
              w: "Wind",
            };
            return names[key.toLowerCase()] || key.toUpperCase();
          };

          const getPollutantUnit = (key: string) => {
            const units: { [key: string]: string } = {
              pm25: " µg/m³",
              pm10: " µg/m³",
              no2: " µg/m³",
              so2: " µg/m³",
              o3: " µg/m³",
              co: " µg/m³",
              t: "°C",
              h: "%",
              p: "hPa",
              w: "m/s",
            };
            return units[key.toLowerCase()] || "";
          };

          try {
            // Fetch real-time data from AQICN API
            const response = await fetch(
              `https://api.waqi.info/feed/@${uid}/?token=${process.env.NEXT_PUBLIC_AQICN_API_KEY}`
            );
            const data = await response.json();

            console.log("AQICN API Response:", data);
            if (data.status === "ok") {
              const popupContent = `
                <div class="max-w-[280px] p-2 space-y-1">
                  <div class="pb-1 border-b border-gray-700">
                    <h2 class="text-sm font-semibold truncate text-white">${
                      data.data.city?.name || "Station"
                    }</h2>
                    <p class="text-[0.7rem] text-gray-400">
                      Updated: ${new Date(
                        data.data.time.iso
                      ).toLocaleTimeString()}
                    </p>
                  </div>

                  <!-- Pollutants Section -->
                  <div class="grid grid-cols-1 gap-y-2 text-xs text-white max-h-[200px] overflow-y-auto">
                    <!-- AQI added first -->
                    <div class="flex justify-between items-center mb-2">
                      <span class="font-medium">AQI</span>
                      <span>${data.data.aqi}</span>
                    </div>
                    
                    ${Object.entries(data.data.iaqi)
                      .filter(([key]) => !["t", "h", "p", "w"].includes(key)) // Exclude weather metrics
                      .map(
                        ([key, value]) => `
                        <div class="flex justify-between items-center">
                          <span class="font-medium">${formatPollutantName(
                            key
                          )}</span>
                          <span>${(value as any).v}${getPollutantUnit(
                          key
                        )}</span>
                        </div>
                      `
                      )
                      .join("")}
                  </div>

                  <!-- Weather Metrics -->
                  <div class="grid grid-cols-1 gap-y-2 text-xs pt-2 border-t">
                    ${Object.entries(data.data.iaqi)
                      .filter(([key]) => ["t", "h", "p", "w"].includes(key)) // Only weather metrics
                      .map(
                        ([key, value]) => `
                        <div class="flex justify-between items-center">
                          <span class="font-medium">${formatPollutantName(
                            key
                          )}</span>
                          <span>${(value as any).v}${getPollutantUnit(
                          key
                        )}</span>
                        </div>
                      `
                      )
                      .join("")}
                  </div>

                  ${
                    data.data.forecast
                      ? `
                  <div class="pt-1 border-t">
                    <p class="text-[0.7rem] mb-1 font-semibold">24h Forecast:</p>
                    <div class="flex overflow-x-auto space-x-2 pb-1">
                      ${Object.entries(data.data.forecast.daily)
                        .map(
                          ([pollutant, days]) => `
                        <div class="text-xs shrink-0">
                          <div class="font-medium">${formatPollutantName(
                            pollutant
                          )}</div>
                          ${(days as any[])
                            .slice(0, 1)
                            .map(
                              (day) => `
                            <div class="text-[0.7rem]">
                              <span>${day.avg}</span>
                              <span class="text-gray-500">(${day.min}-${day.max})</span>
                            </div>
                          `
                            )
                            .join("")}
                        </div>
                      `
                        )
                        .join("")}
                    </div>
                  </div>`
                      : ""
                  }

                  <div class="pt-1 border-t">
                    <div class="text-[0.6rem] space-y-0.5 text-blue-600">
                      ${data.data.attributions
                        .map(
                          (attr: any) => `
                        <a href="${attr.url}" target="_blank" class="hover:underline block truncate">
                          ${attr.name}
                        </a>
                      `
                        )
                        .join("")}
                    </div>
                  </div>

                  <div class="pt-2 border-t border-gray-600 mt-2">
                    <button 
                      class="compare-btn w-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md px-3 text-xs font-medium"
                      data-station='${JSON.stringify({
                        name: data.data.city?.name || "Station",
                        aqi: data.data.aqi,
                        coordinates: coordinates,
                        details: data.data,
                      }).replace(/'/g, "&apos;")}'
                    >
                      Compare
                    </button>
                  </div>
                </div>
              `;

              const popup = new mapboxgl.Popup({
                closeOnClick: false,
                maxWidth: "280px",
              })
                .setLngLat(coordinates)
                .setHTML(popupContent)
                .addTo(map);

              // Add click handler after popup renders
              setTimeout(() => {
                const popupElement = popup.getElement();
                const compareButton =
                  popupElement?.querySelector(".compare-btn");

                if (compareButton) {
                  compareButton.addEventListener("click", () => {
                    const rawData = (compareButton as HTMLElement).dataset
                      .station;
                    if (!rawData) return;

                    try {
                      const stationData = JSON.parse(
                        rawData.replace(/&apos;/g, "'")
                      );
                      window.dispatchEvent(
                        new CustomEvent("compareStation", {
                          detail: stationData,
                        })
                      );
                    } catch (error) {
                      console.error("Error parsing station data:", error);
                    }
                  });
                }
              }, 50);

              if (onCircleClick) {
                onCircleClick(popup);
              }
            } else {
              console.error("API Error:", data.data);
              const popup = new mapboxgl.Popup({ closeOnClick: false })
                .setLngLat(coordinates)
                .setHTML(`<strong>${name}</strong><br>Unable to fetch AQI.`)
                .addTo(map);

              if (onCircleClick) {
                onCircleClick(popup);
              }
            }
          } catch (error) {
            console.error("Fetch Error:", error);
            const popup = new mapboxgl.Popup({ closeOnClick: false })
              .setLngLat(coordinates)
              .setHTML(`<strong>${name}</strong><br>Error fetching data.`)
              .addTo(map);

            if (onCircleClick) {
              onCircleClick(popup);
            }
          }
        }
      });
    }
  }
}

export function AQICNMapCircles(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  onCircleClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded) return;

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: stations.map((station) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [station.lon, station.lat],
      },
      properties: {
        name: station.name,
        aqi: station.aqi,
        uid: station.uid,
      },
    })),
  };

  // Check if the source already exists
  if (map.getSource("stations")) {
    const source = map.getSource("stations") as mapboxgl.GeoJSONSource;
    source.setData(geojson);
  } else {
    // Add the source and layer if they don't exist
    map.addSource("stations", {
      type: "geojson",
      data: geojson,
    });

    map.addLayer({
      id: "stations-circles",
      type: "circle",
      source: "stations",
      paint: {
        "circle-radius": 0,
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "aqi"],
          50,
          "#00FF00",
          100,
          "#FFFF00",
          150,
          "#FFA500",
          200,
          "#FF0000",
        ],
        "circle-opacity": 0.7,
        "circle-stroke-width": 4,
        "circle-stroke-opacity": 0,
      },
    });

    // Add zoom-dependent radius for better click targeting
    map.setPaintProperty("stations-circles", "circle-radius", [
      "interpolate",
      ["linear"],
      ["zoom"],
      5,
      8, // Smaller click area when zoomed out
      10,
      12, // Medium click area
      15,
      16, // Larger click area when zoomed in
    ]);

    if (onCircleClick) {
      map.on("click", "stations-circles", async (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const coordinates = (
            feature.geometry as GeoJSON.Point
          ).coordinates.slice(0, 2) as [number, number];
          const { name, uid } = feature.properties as {
            name: string;
            uid: number;
          };

          try {
            // Fetch real-time data from AQICN API
            const response = await fetch(
              `https://api.waqi.info/feed/@${uid}/?token=${process.env.NEXT_PUBLIC_AQICN_API_KEY}`
            );
            const data = await response.json();

            const stationData: AQICNStation = {
              name: data.data.city?.name || "Station",
              uid: uid.toString(),
              lon: coordinates[0],
              lat: coordinates[1],
              aqi: data.data.aqi,
              state: "active",
              parameter: "AQI",
              pollutants: {
                pm25: data.data.iaqi?.pm25?.v,
                pm10: data.data.iaqi?.pm10?.v,
                o3: data.data.iaqi?.o3?.v,
                no2: data.data.iaqi?.no2?.v,
                so2: data.data.iaqi?.so2?.v,
                co: data.data.iaqi?.co?.v,
              },
              details: data.data,
            };

            console.log("AQICN API Response:", data);
            if (data.status === "ok") {
              const popupContent = `
                <div class="max-w-[280px] p-2 space-y-1">
                  <div class="pb-1 border-b border-gray-700">
                    <h2 class="text-sm font-semibold truncate text-white">${
                      data.data.city?.name || "Station"
                    }</h2>
                    <p class="text-[0.7rem] text-gray-400">
                      Updated: ${new Date(
                        data.data.time.iso
                      ).toLocaleTimeString()}
                    </p>
                  </div>

                  <!-- Pollutants Section -->
                  <div class="grid grid-cols-1 gap-y-2 text-xs text-white max-h-[200px] overflow-y-auto">
                    <!-- AQI added first -->
                    <div class="flex justify-between items-center mb-2">
                      <span class="font-medium">AQI</span>
                      <span>${data.data.aqi} | </span>
                    </div>
                    
                    ${Object.entries(data.data.iaqi)
                      .filter(([key]) => !["t", "h", "p", "w"].includes(key)) // Exclude weather metrics
                      .map(
                        ([key, value]) => `
                        <div class="flex justify-between items-center">
                          <span class="font-medium">${formatPollutantName(
                            key
                          )}</span>
                          <span>${(value as any).v}${getPollutantUnit(
                          key
                        )}</span>
                        </div>
                      `
                      )
                      .join("")}
                  </div>

                  <!-- Weather Metrics -->
                  <div class="grid grid-cols-1 gap-y-2 text-xs pt-2 border-t">
                    ${Object.entries(data.data.iaqi)
                      .filter(([key]) => ["t", "h", "p", "w"].includes(key)) // Only weather metrics
                      .map(
                        ([key, value]) => `
                        <div class="flex justify-between items-center">
                          <span class="font-medium">${formatPollutantName(
                            key
                          )}</span>
                          <span>${(value as any).v}${getPollutantUnit(
                          key
                        )}</span>
                        </div>
                      `
                      )
                      .join("")}
                  </div>

                  ${
                    data.data.forecast
                      ? `
                  <div class="pt-1 border-t">
                    <p class="text-[0.7rem] mb-1 font-semibold">24h Forecast:</p>
                    <div class="flex overflow-x-auto space-x-2 pb-1">
                      ${Object.entries(data.data.forecast.daily)
                        .map(
                          ([pollutant, days]) => `
                        <div class="text-xs shrink-0">
                          <div class="font-medium">${formatPollutantName(
                            pollutant
                          )}</div>
                          ${(days as any[])
                            .slice(0, 1)
                            .map(
                              (day) => `
                            <div class="text-[0.7rem]">
                              <span>${day.avg}</span>
                              <span class="text-gray-500">(${day.min}-${day.max})</span>
                            </div>
                          `
                            )
                            .join("")}
                        </div>
                      `
                        )
                        .join("")}
                    </div>
                  </div>`
                      : ""
                  }

                  <div class="pt-1 border-t">
                    <div class="text-[0.6rem] space-y-0.5 text-blue-600">
                      ${data.data.attributions
                        .map(
                          (attr: any) => `
                        <a href="${attr.url}" target="_blank" class="hover:underline block truncate">
                          ${attr.name}
                        </a>
                      `
                        )
                        .join("")}
                    </div>
                  </div>

                  <div class="pt-2 border-t border-gray-600 mt-2">
                    <button 
                      class="compare-btn w-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md px-3 text-xs font-medium"
                      data-station='${JSON.stringify(stationData).replace(
                        /'/g,
                        "&apos;"
                      )}'
                    >
                      Compare
                    </button>
                  </div>
                </div>
              `;

              // Add these helper functions
              function formatPollutantName(key: string) {
                const names: { [key: string]: string } = {
                  pm25: "PM₂.₅",
                  pm10: "PM₁₀",
                  no2: "NO₂",
                  so2: "SO₂",
                  o3: "O₃",
                  co: "CO",
                  t: "Temp",
                  h: "Humid",
                  p: "Press",
                  w: "Wind",
                };
                return names[key.toLowerCase()] || key.toUpperCase();
              }

              function getPollutantUnit(key: string) {
                const units: { [key: string]: string } = {
                  pm25: " µg/m³",
                  pm10: " µg/m³",
                  no2: " µg/m³",
                  so2: " µg/m³",
                  o3: " µg/m³",
                  co: " µg/m³",
                  t: "°C",
                  h: "%",
                  p: "hPa",
                  w: "m/s",
                };
                return units[key.toLowerCase()] || "";
              }

              const popup = new mapboxgl.Popup({
                closeOnClick: false,
                maxWidth: "280px",
              })
                .setLngLat(coordinates)
                .setHTML(popupContent)
                .addTo(map);

              // Add click handler after popup renders
              setTimeout(() => {
                const popupElement = popup.getElement();
                const compareButton =
                  popupElement?.querySelector(".compare-btn");

                if (compareButton) {
                  compareButton.addEventListener("click", () => {
                    const rawData = (compareButton as HTMLElement).dataset
                      .station;
                    if (!rawData) return;

                    try {
                      const stationData = JSON.parse(
                        rawData.replace(/&apos;/g, "'")
                      );
                      window.dispatchEvent(
                        new CustomEvent("compareStation", {
                          detail: stationData,
                        })
                      );
                    } catch (error) {
                      console.error("Error parsing station data:", error);
                    }
                  });
                }
              }, 50);

              if (onCircleClick) {
                onCircleClick(popup);
              }
            } else {
              console.error("API Error:", data.data);
              const popup = new mapboxgl.Popup({ closeOnClick: false })
                .setLngLat(coordinates)
                .setHTML(`<strong>${name}</strong><br>Unable to fetch AQI.`)
                .addTo(map);

              if (onCircleClick) {
                onCircleClick(popup);
              }
            }
          } catch (error) {
            console.error("Fetch Error:", error);
            const popup = new mapboxgl.Popup({ closeOnClick: false })
              .setLngLat(coordinates)
              .setHTML(`<strong>${name}</strong><br>Error fetching data.`)
              .addTo(map);

            if (onCircleClick) {
              onCircleClick(popup);
            }
          }
        }
      });
    }
  }

  animateCircleGrowth(map, "stations-circles");
}

export function IQAirMapCircles(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  onCircleClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded || stations.length === 0) return;

  const station = stations[0]; // IQAir provides a single station

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [station.lon, station.lat],
        },
        properties: {
          name: station.name,
          aqi: station.aqi,
        },
      },
    ],
  };

  // Check if the source already exists
  if (map.getSource("iqair-station")) {
    const source = map.getSource("iqair-station") as mapboxgl.GeoJSONSource;
    source.setData(geojson);
  } else {
    // Add the source and layer if they don't exist
    map.addSource("iqair-station", {
      type: "geojson",
      data: geojson,
    });

    map.addLayer({
      id: "iqair-circle",
      type: "circle",
      source: "iqair-station",
      paint: {
        "circle-radius": 0, // Fixed radius for a single station
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "aqi"],
          50,
          "#00FF00",
          100,
          "#FFFF00",
          150,
          "#FFA500",
          200,
          "#FF0000",
        ],
        "circle-opacity": 0.7,
      },
    });

    if (onCircleClick) {
      map.on("click", "iqair-circle", (e) => {
        if (e.features && e.features.length > 0) {
          const coordinates = (
            e.features[0].geometry as GeoJSON.Point
          ).coordinates.slice(0, 2) as [number, number];
          const { name, aqi } = e.features[0].properties as {
            name: string;
            aqi: number;
          };

          const popup = new mapboxgl.Popup({ closeOnClick: false })
            .setLngLat(coordinates)
            .setHTML(`<strong>${name}</strong><br>AQI: ${aqi}`)
            .addTo(map);

          if (onCircleClick) {
            onCircleClick(popup);
          }
        }
      });
    }
  }

  // Optional animation
  animateCircleGrowth(map, "iqair-circle");
}

export async function fetchIQAIRData(coords: {
  lat: number;
  lon: number;
}): Promise<Station[]> {
  try {
    const { lat, lon } = coords;
    const apiUrl = `http://api.airvisual.com/v2/city_ranking?key=${process.env.NEXT_PUBLIC_IQAIR_API_KEY}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error("Error response from server:", await response.text());
      return [];
    }

    const data = await response.json();
    console.log("Fetched IQAIR data:", data);

    if (data.status == "success" && data.data) {
      return [
        {
          uid: `${data.data.city}-${data.data.state}-${data.data.country}`,
          lon: data.data.location.coordinates[0],
          lat: data.data.location.coordinates[1],
          name: data.data.city || "null",
          aqi: data.data.forecasts?.[0]?.aqius || 0,
          state: "",
          pollutants: {},
        },
      ];
    }

    console.error("No data available in the response.");
    return [];
  } catch (error) {
    console.error("Failed to fetch AQI data:", error);
    return [];
  }
}

export async function fetchOpenSenseData(
  phenomenon: "PM2.5" | "PM10"
): Promise<Station[]> {
  try {
    const apiUrl = `https://api.opensensemap.org/boxes?full=true&classify=true`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error("Error response from server:", await response.text());
      return [];
    }

    const data = await response.json();

    if (data && Array.isArray(data)) {
      return data
        .filter(
          (box: any) =>
            box.currentLocation &&
            box.sensors.some((sensor: any) => sensor.title === phenomenon)
        )
        .map((box: any) => {
          const sensor = box.sensors.find(
            (sensor: any) => sensor.title === phenomenon
          );
          const lastMeasurement = sensor?.lastMeasurement || {};

          return {
            uid: box._id,
            lon: box.currentLocation.coordinates[0],
            lat: box.currentLocation.coordinates[1],
            name: box.name || "Unknown Station",
            aqi: lastMeasurement.value ? parseFloat(lastMeasurement.value) : 0,
            state: box.state === "active" ? "active" : "inactive",
            parameter: "",
            pollutants: {},
          };
        });
    }

    return [];
  } catch (error) {
    console.error("Failed to fetch OpenSense data:", error);
    return [];
  }
}

export function OpenSenseMapCircles(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  currentPhenomenon: "PM2.5" | "PM10",
  onCircleClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded || stations.length === 0) return;

  // Create GeoJSON with both values
  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: stations.map((station) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [station.lon, station.lat],
      },
      properties: {
        name: station.name,
        value: station.aqi,
        state: station.state,
        phenomenon: currentPhenomenon,
        uid: station.uid,
      },
    })),
  };

  // Threshold configuration
  const radiusStops =
    currentPhenomenon === "PM2.5"
      ? [0, 5, 35.4, 55.4, 150.4, 250.4]
      : [0, 5, 50, 100, 200, 300];

  const colorStops =
    currentPhenomenon === "PM2.5"
      ? [
          0,
          "#00FF00",
          12,
          "#FFFF00",
          35.4,
          "#FFA500",
          55.4,
          "#FF0000",
          150.4,
          "#800080",
          250.4,
          "#800000",
        ]
      : [
          0,
          "#00FF00",
          54,
          "#FFFF00",
          154,
          "#FFA500",
          254,
          "#FF0000",
          354,
          "#800080",
          424,
          "#800000",
        ];

  // Layer management
  const sourceId = "opensensemap-stations";
  const layerId = "opensensemap-circle";

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson);
  } else {
    map.addSource(sourceId, { type: "geojson", data: geojson });
  }

  // Paint properties configuration
  const paintProperties = {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["get", "value"],
      ...radiusStops.flatMap((stop, i) => [stop, 5 + i * 3]),
    ],
    "circle-color": [
      "match",
      ["get", "state"],
      "active",
      ["interpolate", ["linear"], ["get", "value"], ...colorStops],
      "#808080",
    ],
    "circle-opacity": 0.7,
  };
  if (map.getLayer(layerId)) {
    map.setPaintProperty(
      layerId,
      "circle-radius",
      paintProperties["circle-radius"] as any
    );
    map.setPaintProperty(
      layerId,
      "circle-color",
      paintProperties["circle-color"] as any
    );
  } else {
    map.addLayer({
      id: layerId,
      type: "circle",
      source: sourceId,
      paint: {
        ...paintProperties,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "value"],
          ...radiusStops.flatMap((stop, i) => [stop, 5 + i * 3]),
        ],
        "circle-color": [
          "match",
          ["get", "state"],
          "active",
          ["interpolate", ["linear"], ["get", "value"], ...colorStops],
          "#808080",
        ],
        "circle-opacity": 0.7,
      },
    });
  }

  if (onCircleClick) {
    map.on("click", "opensensemap-circle", async (e) => {
      if (e.features?.[0]) {
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
        const properties = e.features[0].properties || {};
        const { name, value, state, phenomenon, uid } = properties;

        try {
          const response = await fetch(
            `https://api.opensensemap.org/boxes/${uid}`
          );
          if (!response.ok)
            throw new Error(`HTTP error! status: ${response.status}`);
          const boxData = await response.json();

          // Helper functions
          const formatSensorName = (title: string) => {
            const names: Record<string, string> = {
              temperatur: "Temperature",
              "rel. luftfeuchte": "Humidity",
              "pm2.5": "PM₂.₅",
              pm10: "PM₁₀",
              "uv-index": "UV Index",
              no2: "NO₂",
              o3: "O₃",
              co: "CO",
            };
            return names[title.toLowerCase()] || title;
          };

          const getSensorUnit = (unit: string) => {
            const units: Record<string, string> = {
              "ug/m³": "µg/m³",
              "°c": "°C",
              "%": "%",
              hpa: "hPa",
              ppm: "ppm",
              ppb: "ppb",
            };
            return units[unit.toLowerCase()] || unit;
          };

          // Process sensor data
          const sensors =
            boxData?.sensors?.map((sensor: any) => ({
              title: formatSensorName(sensor?.title || "Unknown"),
              value: sensor?.lastMeasurement?.value || "N/A",
              unit: getSensorUnit(sensor?.unit || ""),
              type: sensor?.title.toLowerCase().includes("pm")
                ? "pollutant"
                : "weather",
            })) || [];

          const pollutants = sensors.filter((s: any) => s.type === "pollutant");
          const weatherMetrics = sensors.filter(
            (s: any) => s.type === "weather"
          );

          // Coordinates handling
          const coordinates =
            boxData?.currentLocation?.coordinates?.length >= 2
              ? [
                  boxData.currentLocation.coordinates[0],
                  boxData.currentLocation.coordinates[1],
                ]
              : [0, 0];

          const popupContent = `
            <div class="max-w-[280px] p-2 space-y-2">
              <div class="pb-1 border-b border-gray-700">
                <h2 class="text-sm font-semibold truncate text-white">${
                  boxData?.name || "Unnamed Station"
                }</h2>
                <div class="flex justify-between items-center text-[0.7rem] text-gray-400">
                  <span>${
                    state === "active" ? "🟢 Active" : "🔴 Inactive"
                  }</span>
                  <span>${new Date(
                    boxData?.updatedAt || Date.now()
                  ).toLocaleTimeString()}</span>
                </div>
              </div>
  
              <!-- Air Quality Metrics -->
              <div class="grid grid-cols-1 gap-y-2 text-xs text-white max-h-[200px] overflow-y-auto">
                ${
                  pollutants.length > 0
                    ? pollutants
                        .map(
                          (sensor: any) => `
                  <div class="flex justify-between items-center">
                    <span class="font-medium">${sensor.title}</span>
                    <span>${sensor.value}${sensor.unit}</span>
                  </div>
                `
                        )
                        .join("")
                    : `
                  <div class="col-span-3 text-center text-gray-500 py-2">
                    No air quality data
                  </div>
                `
                }
              </div>
  
              <!-- Weather Metrics -->
              <div class="grid grid-cols-1 gap-y-2 text-xs pt-2 border-t">
                ${
                  weatherMetrics.length > 0
                    ? weatherMetrics
                        .map(
                          (sensor: any) => `
                  <div class="flex justify-between items-center">
                    <span class="font-medium">${sensor.title}</span>
                    <span>${sensor.value}${sensor.unit}</span>
                  </div>
                `
                        )
                        .join("")
                    : `
                  <div class="col-span-3 text-center text-gray-500 py-2">
                    No weather data
                  </div>
                `
                }
              </div>
  
              <!-- Additional Information -->
              <div class="pt-2 border-t border-gray-700">
                <div class="text-[0.7rem] space-y-1 text-gray-400">
                  ${
                    boxData?.model
                      ? `<div class="flex justify-between">
                          <span>Model:</span>
                          <span>${boxData.model}</span>
                        </div>`
                      : ""
                  }
                  <div class="flex justify-between">
                    <span>Location:</span>
                    <span>${coordinates[1]?.toFixed(4) || "N/A"}, 
                    ${coordinates[0]?.toFixed(4) || "N/A"}</span>
                  </div>
                  ${
                    boxData?.exposure
                      ? `<div class="flex justify-between">
                          <span>Type:</span>
                          <span>${boxData.exposure}</span>
                        </div>`
                      : ""
                  }
                  ${
                    boxData?.grouptag?.length > 0
                      ? `
                    <div class="flex justify-between">
                      <span>Tags:</span>
                      <span>${boxData.grouptag.join(", ")}</span>
                    </div>
                  `
                      : ""
                  }
                </div>
              </div>

              ${
                boxData?.description
                  ? `
                <div class="pt-2 border-t border-gray-700">
                  <div class="text-[0.7rem] text-gray-400">
                    <div class="font-medium mb-1">Description:</div>
                    <div class="whitespace-normal break-words max-w-full">
                      ${boxData.description}
                    </div>
                  </div>
                </div>
              `
                  : ""
              }

              <!-- Compare Button -->
              <div class="pt-2 border-t border-gray-600 mt-2">
                <button class="compare-btn w-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md px-3 text-xs font-medium"
                  data-station='${JSON.stringify({
                    name: boxData?.name,
                    coordinates: coordinates,
                    sensors: sensors,
                    phenomenon: phenomenon,
                    state: state,
                    model: boxData?.model,
                    lastUpdated: boxData?.updatedAt,
                  }).replace(/'/g, "&apos;")}'>
                  Compare
                </button>
              </div>
            </div>
          `;

          const popup = new mapboxgl.Popup({
            closeOnClick: false,
            maxWidth: "280px",
          })
            .setLngLat([coords[0], coords[1]])
            .setHTML(popupContent)
            .addTo(map);

          // Compare button handler
          setTimeout(() => {
            const compareBtn = popup
              .getElement()
              ?.querySelector(".compare-btn");
            compareBtn?.addEventListener("click", () => {
              const stationDataString = (compareBtn as HTMLElement).dataset
                .station;
              try {
                if (stationDataString) {
                  const stationData = JSON.parse(
                    stationDataString.replace(/&apos;/g, "'")
                  );
                  window.dispatchEvent(
                    new CustomEvent("compareStation", { detail: stationData })
                  );
                }
              } catch (error) {
                console.error("Error parsing station data:", error);
              }
            });
          }, 50);

          onCircleClick?.(popup);
        } catch (error) {
          console.error("Error fetching box details:", error);
          const errorPopup = new mapboxgl.Popup()
            .setLngLat([coords[0], coords[1]])
            .setHTML(
              `<strong>${
                name || "Unknown Station"
              }</strong><br>Error loading data`
            )
            .addTo(map);
          onCircleClick?.(errorPopup);
        }
      }
    });
  }

  animateCircleGrowth(map, layerId);
}

export function OpenSenseMap3D(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  currentPhenomenon: "PM2.5" | "PM10",
  onExtrusionClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded || stations.length === 0) return;

  // Determine pollutant key and thresholds
  const pollutantKey = currentPhenomenon === "PM2.5" ? "pm25" : "pm10";

  const colorStops =
    currentPhenomenon === "PM2.5"
      ? [
          0,
          "#00FF00",
          12,
          "#FFFF00",
          35.4,
          "#FFA500",
          55.4,
          "#FF0000",
          150.4,
          "#800080",
          250.4,
          "#800000",
        ]
      : [
          0,
          "#00FF00",
          54,
          "#FFFF00",
          154,
          "#FFA500",
          254,
          "#FF0000",
          354,
          "#800080",
          424,
          "#800000",
        ];

  // Convert stations to circular polygons with properties
  const features = stations.map((station) => {
    const value = station.aqi || 0; // Use AQI value for visualization
    const circlePolygon = turf.circle([station.lon, station.lat], 0.15, {
      steps: 32,
      units: "kilometers",
    });

    circlePolygon.properties = {
      name: station.name,
      value: value,
      state: station.state,
      aqi: value,
    };

    return circlePolygon;
  });

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
    type: "FeatureCollection",
    features: features as GeoJSON.Feature<GeoJSON.Polygon>[],
  };

  const sourceId = "opensensemap-stations";
  const layerId = "opensensemap-extrusions";

  // Remove existing layer and source if they exist
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  // Add new source and layer
  map.addSource(sourceId, {
    type: "geojson",
    data: geojson,
  });

  map.addLayer({
    id: layerId,
    type: "fill-extrusion",
    source: sourceId,
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        ...colorStops,
      ],
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        0,
        1000,
        50,
        2000,
        100,
        3000,
        150,
        4000,
        200,
        5000,
        300,
        6000,
      ],
      "fill-extrusion-opacity": 0.8,
      "fill-extrusion-vertical-gradient": true,
    },
  });

  if (onExtrusionClick) {
    map.on("click", layerId, (e) => {
      if (!e.features || e.features.length === 0) return;

      const geometry = e.features[0].geometry as GeoJSON.Polygon;
      const coordinates = geometry.coordinates[0][0] as [number, number];
      const { name, value, state } = e.features[0].properties as {
        name: string;
        value: number;
        state: string;
      };

      const popup = new mapboxgl.Popup({ closeOnClick: false })
        .setLngLat(coordinates)
        .setHTML(
          `
          <strong>${name}</strong><br>
          ${currentPhenomenon}: ${value} µg/m³<br>
          Status: ${state === "active" ? "Active" : "Inactive"}
        `
        )
        .addTo(map);

      onExtrusionClick(popup);
    });
  }
}

export async function fetchOpenAQData(pollutantId: number): Promise<Station[]> {
  const limit = "1000";
  let page = 1;
  let allStations: Station[] = []; // Accumulate all stations here
  let totalStations = Infinity;
  const apiUrl = `https://cors-anywhere.herokuapp.com/https://api.openaq.org/v3/parameters/${pollutantId}/latest`;

  try {
    while (allStations.length < totalStations) {
      const url = `${apiUrl}?limit=${limit}&page=${page}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-API-Key": process.env.NEXT_PUBLIC_OPENAQ_API_KEY || "",
        },
      });

      if (!response.ok) {
        console.error("Error response from server:", await response.text());
        return [];
      }

      const data = await response.json();
      console.log(`Fetched page ${page} data:`, data);

      if (page === 1 && data.meta && data.meta.found) {
        totalStations = data.meta.found;
      }

      // Process the response to match the Station[] structure
      if (data && data.results && Array.isArray(data.results)) {
        const stations = data.results.map((result: any) => ({
          uid: result.sensorsId?.toString() || "Unknown Sensor",
          lon: result.coordinates?.longitude || 0,
          lat: result.coordinates?.latitude || 0,
          name: `Location ID: ${result.locationsId || "Unknown"}`,
          aqi: result.value || 0, // Assuming 'value' is the air quality measurement
          state: "", // Add logic if needed to determine state
        }));
        allStations = [...allStations, ...stations];
      } else {
        console.error(`Invalid data format on page ${page}`);
        break;
      }
      // Increment page number to fetch the next page
      page++;
    }

    console.log(`Fetched all stations: ${allStations.length}`);
    return allStations;
  } catch (error) {
    console.error("Failed to fetch OpenAQ data:", error);
    return [];
  }
}
export function OpenAQMapCircles(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  pollutant: string,
  onCircleClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded || stations.length === 0) return;

  // Cleanup ALL existing openaq layers and sources
  const existingLayers = map.getStyle()?.layers || [];
  const existingSources = Object.keys(map.getStyle()?.sources ?? {});

  // Remove all openaq layers
  existingLayers.forEach((layer) => {
    if (layer.id.startsWith("openaq-")) {
      map.removeLayer(layer.id);
    }
  });

  // Remove all openaq sources
  existingSources.forEach((sourceId) => {
    if (sourceId.startsWith("openaq-")) {
      map.removeSource(sourceId);
    }
  });

  const colorScales = {
    pm25: {
      defaultColor: "#00E400", // Good (0-12 µg/m³)
      thresholds: [
        [12, "#FFFF00"], // Moderate (12-35.4)
        [35.5, "#FF7E00"], // USG (35.5-55.4)
        [55.5, "#FF0000"], // Unhealthy (55.5-150.4)
        [150.5, "#8F3F97"], // Very Unhealthy (150.5-250.4)
        [250.5, "#7E0023"], // Hazardous (≥250.5)
      ],
    },
    pm10: {
      defaultColor: "#00E400", // Good (0-54 µg/m³)
      thresholds: [
        [55, "#FFFF00"], // Moderate (55-154 µg/m³)
        [155, "#FF7E00"], // USG (155-254 µg/m³)
        [255, "#FF0000"], // Unhealthy (255-354 µg/m³)
        [355, "#8F3F97"], // Very Unhealthy (355-424 µg/m³)
        [425, "#7E0023"], // Hazardous (≥425 µg/m³)
      ],
    },
    o3: {
      defaultColor: "#00E400", // Good (0-100 µg/m³)
      thresholds: [
        [101, "#FFFF00"], // Moderate (101-160 µg/m³)
        [161, "#FF7E00"], // USG (161-200 µg/m³)
        [201, "#FF0000"], // Unhealthy (201-300 µg/m³)
        [301, "#8F3F97"], // Very Unhealthy (301-600 µg/m³)
        [601, "#7E0023"], // Hazardous (≥601 µg/m³)
      ],
    },
    no2: {
      defaultColor: "#00E400", // Good (0-50 µg/m³)
      thresholds: [
        [51, "#FFFF00"], // Moderate (51-100 µg/m³)
        [101, "#FF7E00"], // USG (101-200 µg/m³)
        [201, "#FF0000"], // Unhealthy (201-400 µg/m³)
        [401, "#8F3F97"], // Very Unhealthy (401-600 µg/m³)
        [601, "#7E0023"], // Hazardous (≥601 µg/m³)
      ],
    },
    so2: {
      defaultColor: "#00E400", // Good (0-50 µg/m³)
      thresholds: [
        [51, "#FFFF00"], // Moderate (51-150 µg/m³)
        [151, "#FF7E00"], // USG (151-250 µg/m³)
        [251, "#FF0000"], // Unhealthy (251-350 µg/m³)
        [351, "#8F3F97"], // Very Unhealthy (351-500 µg/m³)
        [501, "#7E0023"], // Hazardous (≥500 µg/m³)
      ],
    },
    co: {
      defaultColor: "#00E400", // Good (0-4.4 ppm)
      thresholds: [
        [4.5, "#FFFF00"], // Moderate (4.5-9.4 ppm)
        [9.5, "#FF7E00"], // USG (9.5-12.4 ppm)
        [12.5, "#FF0000"], // Unhealthy (12.5-15.4 ppm)
        [15.5, "#8F3F97"], // Very Unhealthy (15.5-30.4 ppm)
        [30.5, "#7E0023"], // Hazardous (≥30.5 ppm)
      ],
    },
  } as const;

  // Validate pollutant
  const validPollutant = pollutant as keyof typeof colorScales;
  if (!colorScales[validPollutant]) {
    console.error(`Invalid pollutant: ${pollutant}`);
    return;
  }

  // Create GeoJSON
  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: stations.map((station) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [station.lon, station.lat],
      },
      properties: {
        name: station.name,
        value: station.aqi,
        pollutant: station.parameter,
      },
    })),
  };

  // Dynamic IDs
  const sourceId = `openaq-${pollutant}-source`;
  const layer2DId = `openaq-${pollutant}-layer`;
  const layer3DId = `openaq-${pollutant}-3d`;

  // Cleanup ALL related layers first
  if (map.getLayer(layer2DId)) map.removeLayer(layer2DId);
  if (map.getLayer(layer3DId)) map.removeLayer(layer3DId);

  // Then remove source
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  // Create proper step expression
  const { defaultColor, thresholds } = colorScales[validPollutant];
  const colorExpression: mapboxgl.Expression = [
    "step",
    ["get", "value"],
    defaultColor,
    ...thresholds.flatMap(([threshold, color]) => [threshold, color]),
  ];

  // Add source and layer
  map.addSource(sourceId, {
    type: "geojson",
    data: geojson,
  });

  map.addLayer({
    id: layer2DId,
    type: "circle",
    source: sourceId,
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        0,
        5,
        100,
        10,
        200,
        15,
        500,
        20,
      ],
      "circle-color": colorExpression,
      "circle-opacity": 0.7,
    },
  });

  // Click handler
  if (onCircleClick) {
    map.on("click", layer2DId, (e) => {
      if (e.features?.[0]) {
        const coordinates = (e.features[0].geometry as GeoJSON.Point)
          .coordinates;
        const props = e.features[0].properties as {
          name: string;
          value: number;
          pollutant: string;
        };

        // Get full station data
        const station = stations.find(
          (s) => s.lon === coordinates[0] && s.lat === coordinates[1]
        );

        const popupContent = `
          <div class="max-w-[300px] space-y-2">
            <h3 class="font-semibold">${props.name}</h3>
            <p class="text-sm">${props.pollutant}: ${props.value} µg/m³</p>
            <button 
              class="compare-btn w-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md px-3 text-xs font-medium"
              data-station='${JSON.stringify({
                name: props.name,
                aqi: props.value,
                coordinates: coordinates,
                parameter: props.pollutant,
                value: props.value,
                units: "µg/m³",
              }).replace(/'/g, "&apos;")}'
            >
              Compare
            </button>
          </div>
        `;

        const popup = new mapboxgl.Popup({
          closeOnClick: false,
          maxWidth: "300px",
        })
          .setLngLat([coordinates[0], coordinates[1]])
          .setHTML(popupContent)
          .addTo(map);

        // Add compare handler after popup renders
        setTimeout(() => {
          const compareButton = popup
            .getElement()
            ?.querySelector(".compare-btn");
          compareButton?.addEventListener("click", () => {
            const rawData = (compareButton as HTMLElement).dataset.station;
            if (!rawData) return;

            try {
              const stationData = JSON.parse(rawData.replace(/&apos;/g, "'"));
              window.dispatchEvent(
                new CustomEvent("compareStation", { detail: stationData })
              );
            } catch (error) {
              console.error("Error parsing station data:", error);
            }
          });
        }, 50);

        onCircleClick(popup);
      }
    });
  }

  // Hover effects
  map.on("mouseenter", layer2DId, () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", layer2DId, () => {
    map.getCanvas().style.cursor = "";
  });

  animateCircleGrowth(map, layer2DId);
}
export function OpenAQMap3D(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  pollutant: string,
  onExtrusionClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded || stations.length === 0) return;

  // Same cleanup logic at the start
  const existingLayers = map.getStyle()?.layers || [];
  const existingSources = Object.keys(map.getStyle()?.sources ?? {});

  existingLayers.forEach((layer) => {
    if (layer.id.startsWith("openaq-")) {
      map.removeLayer(layer.id);
    }
  });

  existingSources.forEach((sourceId) => {
    if (sourceId.startsWith("openaq-")) {
      map.removeSource(sourceId);
    }
  });

  // Use same color scales as OpenAQMapCircles
  const colorScales = {
    pm25: {
      defaultColor: "#00E400", // Good (0-12 µg/m³)
      thresholds: [
        [12, "#FFFF00"], // Moderate (12-35.4)
        [35.5, "#FF7E00"], // USG (35.5-55.4)
        [55.5, "#FF0000"], // Unhealthy (55.5-150.4)
        [150.5, "#8F3F97"], // Very Unhealthy (150.5-250.4)
        [250.5, "#7E0023"], // Hazardous (≥250.5)
      ],
    },
    pm10: {
      defaultColor: "#00E400", // Good (0-54 µg/m³)
      thresholds: [
        [55, "#FFFF00"], // Moderate (55-154)
        [155, "#FF7E00"], // USG (155-254)
        [255, "#FF0000"], // Unhealthy (255-354)
        [355, "#8F3F97"], // Very Unhealthy (355-424)
        [425, "#7E0023"], // Hazardous (≥425)
      ],
    },
    o3: {
      defaultColor: "#00E400", // Good (0-100 µg/m³)
      thresholds: [
        [101, "#FFFF00"], // Moderate (101-160)
        [161, "#FF7E00"], // USG (161-200)
        [201, "#FF0000"], // Unhealthy (201-300)
        [301, "#8F3F97"], // Very Unhealthy (301-400)
        [401, "#7E0023"], // Hazardous (≥401)
      ],
    },
    no2: {
      defaultColor: "#00E400", // Good (0-100 µg/m³)
      thresholds: [
        [101, "#FFFF00"], // Moderate (101-200)
        [201, "#FF7E00"], // USG (201-300)
        [301, "#FF0000"], // Unhealthy (301-400)
        [401, "#8F3F97"], // Very Unhealthy (401-500)
        [501, "#7E0023"], // Hazardous (≥501)
      ],
    },
    so2: {
      defaultColor: "#00E400", // Good (0-100 µg/m³)
      thresholds: [
        [101, "#FFFF00"], // Moderate (101-200)
        [201, "#FF7E00"], // USG (201-350)
        [351, "#FF0000"], // Unhealthy (351-500)
        [501, "#8F3F97"], // Very Unhealthy (501-650)
        [651, "#7E0023"], // Hazardous (≥651)
      ],
    },
    co: {
      defaultColor: "#00E400", // Good (0-4.4 ppm)
      thresholds: [
        [4.5, "#FFFF00"], // Moderate (4.5-9.4)
        [9.5, "#FF7E00"], // USG (9.5-12.4)
        [12.5, "#FF0000"], // Unhealthy (12.5-15.4)
        [15.5, "#8F3F97"], // Very Unhealthy (15.5-30.4)
        [30.5, "#7E0023"], // Hazardous (≥30.5)
      ],
    },
  } as const;

  // Validate pollutant
  const validPollutant = pollutant as keyof typeof colorScales;
  if (!colorScales[validPollutant]) {
    console.error(`Invalid pollutant: ${pollutant}`);
    return;
  }

  // Create features with consistent properties
  const features = stations.map((station) => {
    const circlePolygon = turf.circle([station.lon, station.lat], 0.2, {
      steps: 32,
      units: "kilometers",
    });

    circlePolygon.properties = {
      name: station.name,
      value: station.aqi, // Match 2D property name
      pollutant: station.parameter,
    };

    return circlePolygon;
  });

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
    type: "FeatureCollection",
    features: features as GeoJSON.Feature<GeoJSON.Polygon>[],
  };

  // Dynamic IDs matching 2D version
  const sourceId = `openaq-${pollutant}-source`;
  const layer2DId = `openaq-${pollutant}-layer`;
  const layer3DId = `openaq-${pollutant}-3d`;

  // Cleanup ALL related layers first
  if (map.getLayer(layer2DId)) map.removeLayer(layer2DId);
  if (map.getLayer(layer3DId)) map.removeLayer(layer3DId);

  // Then remove source
  if (map.getSource(sourceId)) map.removeSource(sourceId);
  // Add source
  map.addSource(sourceId, {
    type: "geojson",
    data: geojson,
  });

  // Create color expression matching 2D version
  const { defaultColor, thresholds } = colorScales[validPollutant];
  const colorExpression: mapboxgl.Expression = [
    "step",
    ["get", "value"],
    defaultColor,
    ...thresholds.flatMap(([threshold, color]) => [threshold, color]),
  ];

  // Add 3D extrusion layer
  map.addLayer({
    id: layer3DId,
    type: "fill-extrusion",
    source: sourceId,
    paint: {
      "fill-extrusion-color": colorExpression,
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        0,
        1500, // Base height
        100,
        3000, // Medium pollution
        200,
        5000, // High pollution
      ],
      "fill-extrusion-opacity": 0.8,
      "fill-extrusion-vertical-gradient": true,
    },
  });

  // Click handler with proper typing
  if (onExtrusionClick) {
    map.on("click", layer3DId, (e) => {
      if (e.features?.[0]) {
        const geometry = e.features[0].geometry as GeoJSON.Polygon;
        const coordinates = geometry.coordinates[0][0] as [number, number];
        const props = e.features[0].properties as {
          name: string;
          value: number;
          pollutant: string;
          units: string;
        };

        const popup = new mapboxgl.Popup({ closeOnClick: false })
          .setLngLat(coordinates)
          .setHTML(
            `
            <strong>${props.name}</strong><br>
            ${props.pollutant}: ${props.value} ${props.units}
          `
          )
          .addTo(map);

        onExtrusionClick(popup);
      }
    });
  }

  // Hover effects matching 2D version
  map.on("mouseenter", layer3DId, () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", layer3DId, () => {
    map.getCanvas().style.cursor = "";
  });
}

export function OpenAQMapHeatmap(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  pollutant: string
) {
  if (!map || !isStyleLoaded || stations.length === 0) return;

  // Cleanup existing OpenAQ layers
  const openaqLayerPrefix = "openaq-";
  const openaqSourcePrefix = "openaq-";

  (map.getStyle()?.layers ?? []).forEach((layer) => {
    if (layer.id.startsWith(openaqLayerPrefix)) {
      map.removeLayer(layer.id);
    }
  });

  Object.keys(map.getStyle()?.sources ?? {}).forEach((sourceId) => {
    if (sourceId.startsWith(openaqSourcePrefix)) {
      map.removeSource(sourceId);
    }
  });

  // Enhanced color configurations with better contrast
  const pollutantConfig = {
    PM25: {
      weightStops: [0, 0, 12, 0.5, 35.4, 1.0, 55.4, 1.5, 150.4, 2.0],
      radiusStops: [0, 8, 12, 15, 35.4, 20, 55.4, 25, 150.4, 30],
      colorStops: [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(0, 255, 0, 0)", // Transparent
        0.1,
        "rgba(100, 255, 100, 0.8)", // Bright green
        0.3,
        "rgba(255, 255, 0, 0.9)", // Bright yellow
        0.5,
        "rgba(255, 165, 0, 1.0)", // Orange
        0.7,
        "rgba(255, 0, 0, 1.0)", // Red
        1,
        "rgba(128, 0, 255, 1.0)", // Purple
      ],
    },
    PM10: {
      weightStops: [0, 0, 55, 0.5, 154, 1.0, 254, 1.5, 354, 2.0],
      radiusStops: [0, 8, 55, 15, 154, 20, 254, 25, 354, 30],
      colorStops: [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(40, 167, 69, 0)",
        0.1,
        "rgba(50, 200, 80, 0.8)",
        0.3,
        "rgba(255, 215, 0, 0.9)",
        0.5,
        "rgba(255, 140, 0, 1.0)",
        0.7,
        "rgba(220, 20, 60, 1.0)",
        1,
        "rgba(100, 0, 150, 1.0)",
      ],
    },
    NO2: {
      weightStops: [0, 0, 50, 0.5, 100, 1.0, 200, 1.5, 400, 2.0],
      radiusStops: [0, 8, 50, 15, 100, 20, 200, 25, 400, 30],
      colorStops: [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(102, 221, 255, 0)",
        0.1,
        "rgba(0, 191, 255, 0.8)",
        0.3,
        "rgba(255, 255, 50, 0.9)",
        0.5,
        "rgba(255, 100, 100, 1.0)",
        0.7,
        "rgba(200, 0, 200, 1.0)",
        1,
        "rgba(75, 0, 130, 1.0)",
      ],
    },
    O3: {
      weightStops: [0, 0, 50, 0.5, 100, 1.0, 168, 1.5, 300, 2.0],
      radiusStops: [0, 8, 50, 15, 100, 20, 168, 25, 300, 30],
      colorStops: [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(0, 128, 255, 0)",
        0.1,
        "rgba(0, 200, 255, 0.8)",
        0.3,
        "rgba(0, 255, 255, 0.9)",
        0.5,
        "rgba(255, 200, 0, 1.0)",
        0.7,
        "rgba(255, 50, 50, 1.0)",
        1,
        "rgba(128, 0, 128, 1.0)",
      ],
    },
  };

  const config =
    pollutantConfig[pollutant as keyof typeof pollutantConfig] ||
    pollutantConfig.PM25;

  // Create GeoJSON data source
  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: stations.map((station) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [station.lon, station.lat],
      },
      properties: {
        value: station.aqi,
        parameter: station.parameter,
      },
    })),
  };

  const sourceId = "openaq-heatmap-source";
  const layerId = "openaq-heatmap-layer";

  // Add data source
  map.addSource(sourceId, {
    type: "geojson",
    data: geojson,
  });

  // Enhanced heatmap configuration
  map.addLayer({
    id: layerId,
    type: "heatmap",
    source: sourceId,
    paint: {
      "heatmap-weight": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        ...config.weightStops,
      ],
      "heatmap-intensity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        1.5, // More intense at all zoom levels
        15,
        4.0,
      ],
      "heatmap-color": config.colorStops as [string, ...any[]],
      "heatmap-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        ["interpolate", ["linear"], ["get", "value"], ...config.radiusStops],
        15,
        [
          "interpolate",
          ["linear"],
          ["get", "value"],
          ...config.radiusStops.map((v, i) => (i % 2 === 1 ? v * 2.5 : v)), // Larger radius when zoomed in
        ],
      ],
      "heatmap-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0.7, // More transparent when zoomed out
        15,
        0.95, // More opaque when zoomed in
      ],
    },
  });

  return () => {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  };
}
export async function fetchOpenWeatherData(coords: {
  lat: number;
  lon: number;
}): Promise<Station[]> {
  try {
    const { lat, lon } = coords;
    const apiUrl = `http://api.openweathermap.org/data/2.5/air_pollution?lat=${lat.toFixed(
      4
    )}&lon=${lon.toFixed(4)}&appid=${
      process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
    }`;
    const response = await fetch(apiUrl);

    if (!response.ok) return [];
    const data = await response.json();
    console.log("Fetched data:", data);

    if (data?.list?.length > 0) {
      return data.list.map((entry: any) => ({
        uid: `OpenWeather-${data.coord.lat}-${data.coord.lon}`,
        lon: data.coord.lon,
        lat: data.coord.lat,
        name: `OpenWeather-${data.coord.lat}-${data.coord.lon}`,
        aqi: entry.main.aqi,
        pollutants: {
          pm25: entry.components.pm2_5,
          pm10: entry.components.pm10,
          o3: entry.components.o3,
          no2: entry.components.no2,
          so2: entry.components.so2,
          co: entry.components.co,
        },
        state: "",
      }));
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch Openweather data:", error);
    return [];
  }
}

export function OpenWeatherMapCircles(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  selectedPollutant: string,
  onCircleClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded || stations.length === 0) return;

  // Cleanup previous instances
  const layerId = "openweather-circle";
  const sourceId = "openweather-station";

  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }

  // Create fresh GeoJSON data
  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: stations
      .map((station) => {
        if (!selectedPollutant) return null;

        const value =
          selectedPollutant === "aqi"
            ? station.aqi
            : station.pollutants?.[
                selectedPollutant as keyof typeof station.pollutants
              ] ?? null;

        if (value === null) return null;

        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [station.lon, station.lat],
          },
          properties: {
            uid: station.uid,
            name: station.name,
            aqi: station.aqi,
            state: station.state,
            lon: station.lon,
            lat: station.lat,
            value,
            pollutants: station.pollutants,
          },
        };
      })
      .filter(
        (
          feature
        ): feature is GeoJSON.Feature<GeoJSON.Point> & {
          properties: {
            value: number;
            uid: string;
            name: string;
            aqi: number;
            state: string;
            lon: number;
            lat: number;
            pollutants: {
              pm25?: number;
              pm10?: number;
              o3?: number;
              no2?: number;
              so2?: number;
              co?: number;
            };
          };
        } => feature !== null && feature.properties !== null
      ),
  };

  if (geojson.features.length === 0) return;

  // Add source and layer
  map.addSource(sourceId, {
    type: "geojson",
    data: geojson,
    generateId: true,
  });

  map.addLayer({
    id: layerId,
    type: "circle",
    source: sourceId,
    paint: {
      "circle-radius": 20,
      "circle-color": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        ...getColorStops(selectedPollutant),
      ],
      "circle-opacity": 0.9,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  // Start animation with safety checks
  const cleanupAnimation = () => {
    animateCircleGrowth(map, layerId);
  };

  // Click handler with comparison feature
  let currentPopup: mapboxgl.Popup | null = null;

  const clickHandler = (e: mapboxgl.MapMouseEvent) => {
    currentPopup?.remove();

    if (!e.features?.[0]) return;

    const { properties, geometry } = e.features[0];
    const coordinates = (geometry as GeoJSON.Point).coordinates as [
      number,
      number
    ];
    const pollutantsData =
      typeof properties?.pollutants === "string"
        ? JSON.parse(properties.pollutants)
        : properties?.pollutants;

    const popupContent = `
      <div class="max-w-[300px] space-y-2">
        <h3 class="font-semibold">${properties?.name ?? "Unknown"}</h3>
        
       <p>PM2.5: <strong>${pollutantsData?.pm25 ?? ""}</strong> µg/m³</p>
<p>PM10: <strong>${pollutantsData?.pm10 ?? ""}</strong> µg/m³</p>
<p>O3: <strong>${pollutantsData?.o3 ?? ""}</strong> µg/m³</p>
<p>NO2: <strong>${pollutantsData?.no2 ?? ""}</strong> µg/m³</p>
<p>SO2: <strong>${pollutantsData?.so2 ?? ""}</strong> µg/m³</p>
<p>CO: <strong>${pollutantsData?.co ?? ""}</strong> µg/m³</p>
        <div class="pt-2 border-t border-gray-600 mt-2">
          <button class="compare-btn w-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md px-3 text-xs font-medium"
            data-station='${JSON.stringify({
              name: properties?.name,
              aqi: properties?.aqi,
              coordinates: coordinates,
              details: {
                pollutants: pollutantsData,
                lat: coordinates[1],
                lon: coordinates[0],
                timestamp: new Date().toISOString(),
              },
            }).replace(/'/g, "&apos;")}'>
            Compare
          </button>
        </div>
      </div>
    `;

    currentPopup = new mapboxgl.Popup({ closeOnClick: false })
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);

    // Add compare button handler
    setTimeout(() => {
      const compareButton = currentPopup
        ?.getElement()
        ?.querySelector(".compare-btn");
      compareButton?.addEventListener("click", () => {
        const rawData = (compareButton as HTMLElement).dataset.station;
        if (!rawData) return;

        try {
          const stationData = JSON.parse(rawData.replace(/&apos;/g, "'"));
          window.dispatchEvent(
            new CustomEvent("compareStation", { detail: stationData })
          );
        } catch (error) {
          console.error("Error parsing station data:", error);
        }
      });
    }, 50);

    onCircleClick?.(currentPopup);
  };

  // Register click handler
  map.on("click", layerId, clickHandler);

  // Cleanup function
  return () => {
    cleanupAnimation();
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    map.off("click", layerId, clickHandler);
    currentPopup?.remove();
  };
}

// Helper function to generate color stops remains unchanged
function getColorStops(pollutant: string): any[] {
  const thresholdConfig: { [key: string]: number[] } = {
    pm25: [0, 12, 35, 55, 150, 250],
    pm10: [0, 55, 155, 255, 355, 425],
    no2: [0, 54, 101, 361, 650, 1250],
    o3: [0, 55, 71, 86, 106, 201],
    so2: [0, 36, 76, 186, 305, 605],
    co: [0, 4.5, 9.5, 12.5, 15.5, 31],
  };

  const colors = [
    "#00e400",
    "#ffff00",
    "#ff7e00",
    "#ff0000",
    "#8f3f97",
    "#7e0023",
  ];
  const thresholds = thresholdConfig[pollutant] || [0, 51, 101, 201, 301, 401];

  console.log(`Color stops for ${pollutant}:`, thresholds);

  return thresholds.flatMap((threshold, index) => [threshold, colors[index]]);
}

export function OpenWeatherMap3D(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  selectedPollutant: string,
  onExtrusionClick?: (popup: mapboxgl.Popup) => void
) {
  // Comprehensive early exit check
  if (!map || !isStyleLoaded || stations.length === 0 || !selectedPollutant) {
    if (map.getLayer("openweather-extrusion"))
      map.removeLayer("openweather-extrusion");
    if (map.getSource("openweather-station"))
      map.removeSource("openweather-station");
    return;
  }

  // Filter valid stations
  const validStations = stations.filter((station) => {
    const value =
      selectedPollutant === "aqi"
        ? station.aqi
        : station.pollutants?.[
            selectedPollutant as keyof typeof station.pollutants
          ];
    return value !== null && value !== undefined;
  });

  if (validStations.length === 0) {
    if (map.getLayer("openweather-extrusion"))
      map.removeLayer("openweather-extrusion");
    if (map.getSource("openweather-station"))
      map.removeSource("openweather-station");
    return;
  }

  // Create features from FILTERED stations
  const features = validStations.map((station) => {
    const circlePolygon = turf.circle([station.lon, station.lat], 0.1, {
      steps: 32,
      units: "kilometers",
    });

    const value =
      selectedPollutant === "aqi"
        ? station.aqi
        : station.pollutants[
            selectedPollutant as keyof typeof station.pollutants
          ]!;

    circlePolygon.properties = {
      uid: station.uid,
      name: station.name,
      value: value,
      aqi: station.aqi,
      pollutants: station.pollutants,
      lon: station.lon,
      lat: station.lat,
    };

    return circlePolygon;
  });

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
    type: "FeatureCollection",
    features: features as GeoJSON.Feature<GeoJSON.Polygon>[],
  };

  const sourceId = "openweather-station";
  const layerId = "openweather-extrusion";

  // Cleanup existing resources
  if (map.getSource(sourceId)) map.removeSource(sourceId);
  if (map.getLayer(layerId)) map.removeLayer(layerId);

  // Add new source and layer
  map.addSource(sourceId, { type: "geojson", data: geojson });

  const colorStops = getColorStops(selectedPollutant);

  map.addLayer({
    id: layerId,
    type: "fill-extrusion",
    source: sourceId,
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        ...colorStops,
      ],
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["get", "value"],
        0,
        1000,
        50,
        1500,
        100,
        2000,
        150,
        2500,
        200,
        3000,
        300,
        4000,
      ],
      "fill-extrusion-opacity": 0.8,
      "fill-extrusion-vertical-gradient": true,
    },
  });

  // Click handler with proper typing
  const clickHandler = (e: mapboxgl.MapMouseEvent) => {
    if (!e.features?.[0]?.properties) return;

    const { properties, geometry } = e.features[0];
    const coordinates = (geometry as GeoJSON.Polygon).coordinates[0][0] as [
      number,
      number
    ];
    const pollutantsData =
      typeof properties?.pollutants === "string"
        ? JSON.parse(properties.pollutants)
        : properties?.pollutants;

    // In OpenWeatherMap3D's click handler, replace the popupContent with:
    const popupContent = `
  <div class="max-w-[300px] space-y-2">
    <h3 class="font-semibold">${properties.name || "OpenWeather Station"}</h3>
    
    <p>PM2.5: <strong>${pollutantsData?.pm25 ?? ""}</strong> µg/m³</p>
    <p>PM10: <strong>${pollutantsData?.pm10 ?? ""}</strong> µg/m³</p>
    <p>O3: <strong>${pollutantsData?.o3 ?? ""}</strong> µg/m³</p>
    <p>NO2: <strong>${pollutantsData?.no2 ?? ""}</strong> µg/m³</p>
    <p>SO2: <strong>${pollutantsData?.so2 ?? ""}</strong> µg/m³</p>
    <p>CO: <strong>${pollutantsData?.co ?? ""}</strong> µg/m³</p>

    <div class="pt-2 border-t border-gray-600 mt-2">
      <button class="compare-btn w-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md px-3 text-xs font-medium"
        data-station='${JSON.stringify({
          name: properties.name,
          aqi: properties.aqi,
          coordinates: coordinates,
          details: {
            pollutants: pollutantsData,
            lat: coordinates[1],
            lon: coordinates[0],
            timestamp: new Date().toISOString(),
          },
        }).replace(/'/g, "&apos;")}'>
        Compare
      </button>
    </div>
  </div>
`;

    const popup = new mapboxgl.Popup({ closeOnClick: false })
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);

    // Add compare handler
    setTimeout(() => {
      const btn = popup.getElement()?.querySelector(".compare-btn");
      btn?.addEventListener("click", () => {
        const data = (btn as HTMLElement).dataset.station;
        if (!data) return;

        try {
          const stationData = JSON.parse(data.replace(/&apos;/g, "'"));
          window.dispatchEvent(
            new CustomEvent("compareStation", { detail: stationData })
          );
        } catch (error) {
          console.error("Comparison error:", error);
        }
      });
    }, 50);

    onExtrusionClick?.(popup);
  };

  map.on("click", layerId, clickHandler);

  // Cleanup
  return () => {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    map.off("click", layerId, clickHandler);
  };
}

export function addWindLayer(map: mapboxgl.Map, isStyleLoaded: boolean) {
  if (!map || !isStyleLoaded) return;

  const layerName = "wind";
  const sourceId = "openweather-wind-source";
  const layerId = "openweather-wind-layer";

  // Remove existing layer if it exists
  // Remove layer if it exists
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }

  // Remove source if it exists (to ensure a clean re-add)
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }

  // Add a raster source pointing to the wind_new tile endpoint
  // Note the {z}/{x}/{y} placeholders so Mapbox loads the correct tiles.
  map.addSource(sourceId, {
    type: "raster-array",
    url: `mapbox://rasterarrayexamples.gfs-winds`,
    tileSize: 512,
    attribution: "",
  });

  // Add new layer with proper ordering
  map.addLayer({
    id: layerId,
    type: "raster-particle",
    source: sourceId,
    "source-layer": "10winds",

    paint: {
      "raster-particle-speed-factor": 0.4,
      "raster-particle-fade-opacity-factor": 0.95,
      "raster-particle-reset-rate-factor": 0.4,
      "raster-particle-count": 8000,
      "raster-particle-max-speed": 40,
      "raster-particle-color": [
        "interpolate",
        ["linear"],
        ["raster-particle-speed"],
        1.5,
        "rgba(134,163,171,256)",
        2.5,
        "rgba(126,152,188,256)",
        4.12,
        "rgba(110,143,208,256)",
        4.63,
        "rgba(110,143,208,256)",
        6.17,
        "rgba(15,147,167,256)",
        7.72,
        "rgba(15,147,167,256)",
        9.26,
        "rgba(57,163,57,256)",
        10.29,
        "rgba(57,163,57,256)",
        11.83,
        "rgba(194,134,62,256)",
        13.37,
        "rgba(194,134,63,256)",
        14.92,
        "rgba(200,66,13,256)",
        16.46,
        "rgba(200,66,13,256)",
        18.0,
        "rgba(210,0,50,256)",
        20.06,
        "rgba(215,0,50,256)",
        21.6,
        "rgba(175,80,136,256)",
        23.66,
        "rgba(175,80,136,256)",
        25.21,
        "rgba(117,74,147,256)",
        27.78,
        "rgba(117,74,147,256)",
        29.32,
        "rgba(68,105,141,256)",
        31.89,
        "rgba(68,105,141,256)",
        33.44,
        "rgba(194,251,119,256)",
        42.18,
        "rgba(194,251,119,256)",
        43.72,
        "rgba(241,255,109,256)",
        48.87,
        "rgba(241,255,109,256)",
        50.41,
        "rgba(256,256,256,256)",
        57.61,
        "rgba(256,256,256,256)",
        59.16,
        "rgba(0,256,256,256)",
        68.93,
        "rgba(0,256,256,256)",
        69.44,
        "rgba(256,37,256,256)",
      ],
    },
  }); // Place before hillshade layer
}

export function AQICNMapHeatmap(
  map: mapboxgl.Map,
  stations: Station[],
  isStyleLoaded: boolean,
  onHeatmapClick?: (popup: mapboxgl.Popup) => void
) {
  if (!map || !isStyleLoaded) return;

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features: stations.map((station) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [station.lon, station.lat],
      },
      properties: {
        aqi: station.aqi,
      },
    })),
  };

  const sourceId = "aqicn-heatmap-source";
  const layerId = "aqicn-heatmap";

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson);
  } else {
    map.addSource(sourceId, {
      type: "geojson",
      data: geojson,
    });

    map.addLayer({
      id: layerId,
      type: "heatmap",
      source: sourceId,
      paint: {
        // Use AQI value directly for weight
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "aqi"],
          0,
          0,
          50,
          0.3,
          100,
          0.6,
          200,
          1,
          300,
          1.2,
        ],
        // Intensity based on zoom level
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          1,
          15,
          3,
        ],
        // Hybrid color scale - combines AQI colors with heatmap density
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0, 255, 0, 0)", // Green (transparent)
          0.15,
          "rgba(0, 255, 0, 0.4)", // Green
          0.3,
          "rgba(255, 255, 0, 0.5)", // Yellow
          0.5,
          "rgba(255, 165, 0, 0.6)", // Orange
          0.7,
          "rgba(255, 0, 0, 0.7)", // Red
          1,
          "rgba(128, 0, 128, 0.8)", // Purple
        ],
        // Radius combines zoom level and AQI value
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          11,
          ["interpolate", ["linear"], ["get", "aqi"], 0, 5, 300, 25],
          15,
          ["interpolate", ["linear"], ["get", "aqi"], 0, 15, 300, 40],
        ],
        "heatmap-opacity": 0.8,
      },
    });
  }
}

export interface AstonFeatureProperties {
  datetime_UTC: string;
  ambHumidity_mean: number | null;
  ambTempC_mean: number | null;
  particulatePM10_mean: number | null;
  "particulatePM2.5_mean": number | null; // Use quoted property name#
  sensorid: number;
  // Add any other properties that might exist
}

type AstonGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Polygon, // Use Polygon
  AstonFeatureProperties
>;

// --- Aston Data Fetching Function ---

// Define the expected parameters for the function
interface FetchAstonParams {
  startDate: string; // Input start date, expected in a format Date() can parse (e.g., 'YYYY-MM-DD')
  averagingMethod: string;
  averagingFrequency: string;
}

interface ApiSensorResponse {
  sensorid: number;
  sensorType: string;
  geojson: GeoJSON.FeatureCollection<
    GeoJSON.Polygon,
    Omit<AstonFeatureProperties, "sensorid" | "sensorType">
  >;
}

export async function fetchAstonData(
  params: FetchAstonParams
): Promise<AstonGeoJSON | null> {
  const {
    startDate: startDateString,
    averagingMethod,
    averagingFrequency,
  } = params;
  console.log(
    `Fetching Aston data for start date: ${startDateString}, method: ${averagingMethod}, frequency: ${averagingFrequency}`
  );

  const baseUrl = process.env.NEXT_PUBLIC_AIRQUALITY_API_URL;
  if (!baseUrl) {
    console.error(
      "Aston API URL configuration is missing (NEXT_PUBLIC_AIRQUALITY_API_URL)."
    );
    return null;
  }

  try {
    // --- Date Formatting Logic ---
    const startDate = new Date(startDateString);
    if (isNaN(startDate.getTime())) {
      console.error("Invalid start date provided:", startDateString);
      return null;
    }

    const formatDate = (date: Date) => {
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    // --- URL Construction ---
    const queryParams = new URLSearchParams({
      start: formatDate(startDate),
      end: formatDate(endDate),
      averaging_frequency: averagingFrequency,
      averaging_methods: averagingMethod,
    });

    const endpoint = "sensor-summary/as-geojson";
    const requestURL = `${baseUrl.replace(
      /\/$/,
      ""
    )}/${endpoint}?${queryParams.toString()}`;

    console.log("Requesting Aston Data from:", requestURL);
    const response = await fetch(requestURL, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error ${response.status}:`, errorText);
      return null;
    }

    const responseData: unknown = await response.json();
    console.log("Aston API response:", responseData);
    console.groupCollapsed("[Aston] Response validation");

    // Validate response structure
    if (!Array.isArray(responseData)) {
      console.error("Invalid response format - expected array of sensors");
      console.groupEnd();
      return null;
    }

    if (responseData.length === 0) {
      console.warn("Empty response array - no sensors found");
      console.groupEnd();
      return null;
    }

    // Aggregate features from all sensors
    const allFeatures: GeoJSON.Feature<
      GeoJSON.Polygon,
      AstonFeatureProperties
    >[] = [];
    for (const sensor of responseData) {
      // Validate sensor structure
      if (
        typeof sensor !== "object" ||
        sensor === null ||
        typeof sensor.sensorid !== "number" ||
        typeof sensor.sensorType !== "string" ||
        !sensor.geojson?.features
      ) {
        console.warn("Invalid sensor structure", sensor);
        continue;
      }

      // Add sensor metadata to each feature
      const featuresWithSensorData = sensor.geojson.features.map(
        (
          feature: GeoJSON.Feature<
            GeoJSON.Polygon,
            Omit<AstonFeatureProperties, "sensorid" | "sensorType">
          >
        ) => ({
          ...feature,
          properties: {
            ...feature.properties,
            sensorid: sensor.sensorid,
            sensorType: sensor.sensorType,
          },
        })
      ) as GeoJSON.Feature<GeoJSON.Polygon, AstonFeatureProperties>[];

      allFeatures.push(...featuresWithSensorData);
    }

    if (allFeatures.length === 0) {
      console.warn("No valid features found in any sensor data");
      return null;
    }

    const combinedGeoJSON: AstonGeoJSON = {
      type: "FeatureCollection",
      features: allFeatures.filter(
        (f) =>
          f.geometry.type === "Polygon" &&
          f.properties.datetime_UTC &&
          f.geometry.coordinates.length > 0
      ),
    };

    console.groupEnd();
    return combinedGeoJSON;
  } catch (error) {
    console.error("Error fetching or processing Aston data:", error);
    return null;
  }
}

export function AstonMapLayer(
  map: mapboxgl.Map,
  data: AstonGeoJSON,
  selectedHour: number,
  selectedDate: string, // Add selected date (YYYY-MM-DD format)
  isStyleLoaded: boolean,
  onFeatureClick?: (popup: mapboxgl.Popup) => void
) {
  if (!isStyleLoaded) return;

  const sourceId = "aston-sensor-source";
  const layerId = "aston-sensor-layer-3d";
  let currentPopup: mapboxgl.Popup | null = null;

  // Cleanup existing layers first
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  // Parse selected date
  const [year, month, day] = selectedDate.split("-").map(Number);

  // Filter features to match selected date and hour
  const validFeatures = data.features.filter((f) => {
    if (!f.properties.datetime_UTC) return false;

    try {
      const isoDate = f.properties.datetime_UTC.endsWith("Z")
        ? f.properties.datetime_UTC
        : `${f.properties.datetime_UTC}Z`;

      const featureDate = new Date(isoDate);

      return (
        f.geometry.type === "Polygon" &&
        f.geometry.coordinates.length > 0 &&
        featureDate.getUTCFullYear() === year &&
        featureDate.getUTCMonth() + 1 === month && // Months are 0-indexed
        featureDate.getUTCDate() === day &&
        featureDate.getUTCHours() === selectedHour
      );
    } catch {
      return false;
    }
  });
  if (validFeatures.length === 0) {
    console.warn("No valid Aston features to display for selected hour");
    return;
  }

  if (validFeatures.length === 0) {
    console.warn("No valid Aston features to display");
    return;
  }

  // Add GeoJSON source
  map.addSource(sourceId, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: validFeatures,
    },
  });

  // Add 3D extrusion layer
  map.addLayer({
    id: layerId,
    type: "fill-extrusion",
    source: sourceId,
    paint: {
      "fill-extrusion-color": [
        "case",
        ["has", "particulatePM2.5_mean"],
        [
          "interpolate",
          ["linear"],
          ["get", "particulatePM2.5_mean"],
          0,
          "#4F46E5",
          50,
          "#EF4444",
        ],
        "#94A3B8",
      ],
      "fill-extrusion-height": [
        "case",
        ["has", "particulatePM2.5_mean"],
        ["*", ["get", "particulatePM2.5_mean"], 15],
        15,
      ],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 1,
    },
  });

  // Single click handler with proper filtering
  const handleClick = (e: mapboxgl.MapMouseEvent) => {
    if (!e.features) return;

    // Find first feature that exactly matches the selected hour
    const feature = e.features.find((f) => {
      try {
        const featureDate = new Date(f.properties?.datetime_UTC);
        return featureDate.getUTCHours() === selectedHour;
      } catch {
        return false;
      }
    });

    if (!feature) return;

    // Remove previous popup
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }

    const properties = feature.properties || {};
    const coordinates = e.lngLat;

    // Date formatting with explicit UTC handling
    const formatUTCDate = (isoString: string) => {
      const isoDate = isoString.endsWith("Z") ? isoString : `${isoString}Z`;
      const date = new Date(isoDate);

      return {
        date: [
          String(date.getUTCDate()).padStart(2, "0"),
          String(date.getUTCMonth() + 1).padStart(2, "0"),
          date.getUTCFullYear(),
        ].join("/"),
        time: [
          String(date.getUTCHours()).padStart(2, "0"),
          String(date.getUTCMinutes()).padStart(2, "0"),
        ].join(":"),
      };
    };
    // Formatting helpers
    const formatKey = (key: string) => {
      const replacements: Record<string, string> = {
        datetime_UTC: "Date Time",
        particulatePM2: "PM₂.₅",
        particulatePM10: "PM₁₀",
        ambHumidity: "Humidity",
        ambTempC: "Temperature",
        mean: "(Mean)",
        max: "(Max)",
        min: "(Min)",
        std: "(Std Dev)",
        _: " ",
      };

      return key
        .replace(/([A-Z0-9₂₁₀.]+)|_/g, (match) => replacements[match] || match)
        .replace(/(\b\w)/g, (m) => m.toUpperCase())
        .replace(/Pm/g, "PM");
    };

    const formatValue = (key: string, value: any) => {
      if (value === null || value === undefined) return "N/A";

      const unitMap: Record<string, string> = {
        particulatePM: "µg/m³",
        ambTempC: "°C",
        ambHumidity: "%",
        pressure: "hPa",
        windSpeed: "m/s",
        windDirection: "°",
      };

      const unit = Object.keys(unitMap).find((k) => key.startsWith(k)) || "";
      return typeof value === "number"
        ? `${value.toFixed(2)}${unitMap[unit] || ""}`
        : value;
    };

    // Create popup content
    const popupContent = `
      <div class="max-w-[400px] p-3 space-y-2">
        <div>
          <h2 class="text-lg font-semibold text-white mb-0.5">Sensor ${
            properties.sensorid || "Unknown"
          }</h2>
          <div class="text-[0.8rem] text-gray-300 mb-2">${
            formatUTCDate(properties.datetime_UTC).date
          } ${formatUTCDate(properties.datetime_UTC).time} UTC</div>
        </div>
        <div class="space-y-1 text-[0.98rem]">
          ${Object.entries(properties)
            .filter(
              ([key]) =>
                key.startsWith("amb") || key.startsWith("particulatePM")
            )
            .map(
              ([key, value]) => `
                <div class="grid grid-cols-[auto,auto] items-center">
                  <span class="text-white">${formatKey(key)}</span>
                  <span class="font-bold text-white pl-4 whitespace-nowrap">${formatValue(
                    key,
                    value
                  )}</span>
                </div>
              `
            )
            .join("")}
          <div class="grid grid-cols-[auto,auto] items-center min-w-0">
            <span class="text-white truncate">Sensorid:</span>
            <span class="font-bold text-white whitespace-nowrap">${
              properties.sensorid ?? "N/A"
            }</span>
          </div>
          <div class="grid grid-cols-[auto,auto] items-center min-w-0">
            <span class="text-white truncate">SensorType:</span>
            <span class="font-bold text-white whitespace-nowrap">${
              properties.sensorType ?? "N/A"
            }</span>
          </div>
        </div>
        <div class="text-[0.85rem] text-gray-400 mt-2 flex justify-between">
          <span>Coordinates:</span>
          <span>${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(
      4
    )}</span>
        </div>
        <div class="pt-2">
          <button class="compare-btn w-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md px-3 text-xs font-medium"
            data-feature='${JSON.stringify({
              coordinates: coordinates.toArray(),
              properties: properties,
              datetime: properties.datetime_UTC,
            }).replace(/'/g, "&apos;")}'>
            Compare
          </button>
        </div>
      </div>
    `;

    // Create and manage single popup instance
    currentPopup = new mapboxgl.Popup({
      closeOnClick: false,
      maxWidth: "400px",
      className: "aston-popup",
    })
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);

    // Add compare button handler
    setTimeout(() => {
      const compareBtn = currentPopup
        ?.getElement()
        ?.querySelector(".compare-btn");
      compareBtn?.addEventListener("click", () => {
        const featureDataString = (compareBtn as HTMLElement).dataset.feature;
        try {
          if (featureDataString) {
            const featureData = {
              sensorId: properties.sensorid,
              sensorType: properties.sensorType,
              datetime: properties.datetime_UTC,
              coordinates: coordinates.toArray(),
              measurements: {
                pm25: properties["particulatePM2.5_mean"],
                pm10: properties.particulatePM10_mean,
                temperature: properties.ambTempC_mean,
                humidity: properties.ambHumidity_mean,
              },
            };
            window.dispatchEvent(
              new CustomEvent("compareAstonFeature", {
                detail: featureData,
              })
            );
          }
        } catch (error) {
          console.error("Error parsing feature data:", error);
        }
      });
    }, 50);

    onFeatureClick?.(currentPopup);
  };

  // Cleanup previous handlers
  map.off("click", layerId, handleClick);

  // Add new handlers
  map.on("click", layerId, handleClick);

  // Return cleanup function
  return () => {
    map.off("click", layerId, handleClick);
    currentPopup?.remove();
    map.removeLayer(layerId);
    map.removeSource(sourceId);
  };
}
