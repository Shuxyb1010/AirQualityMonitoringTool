"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import mapboxgl, { Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Spinner } from "@/components/ui/spinner";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Station,
  toggleAirQualityLayer,
  createThrottledMoveHandler,
} from "../lib/actions/map.actions";
import {
  fetchAQICNData,
  fetchIQAIRData,
  AQICNMapCircles,
  IQAirMapCircles,
  addWindLayer,
  fetchOpenSenseData,
  OpenSenseMapCircles,
  OpenAQMapCircles,
  fetchOpenAQData,
  OpenWeatherMapCircles,
  fetchOpenWeatherData,
  AQICNMap3D,
  OpenAQMap3D,
  OpenWeatherMap3D,
  OpenSenseMap3D,
  AQICNMapHeatmap,
  OpenAQMapHeatmap,
  fetchAstonData,
  AstonFeatureProperties,
  AstonMapLayer,
} from "../lib/actions/source.actions";
import {
  ArrowBigDown,
  ArrowBigLeft,
  ArrowBigRight,
  ArrowBigUp,
  CircleMinus,
  CirclePlus,
  Search,
  Compass,
  LocateFixed,
  ListRestart,
  RotateCcw,
} from "lucide-react";
import { OpenSenseDataManager } from "./api/opensense-data-manager";
import DatePickerWithRange from "../components/ui/datepicker";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OPENAQ_POLLUTANT_MAP } from "@/constants";
import { Slider } from "@/components/ui/slider";
import {
  AqicnStationCard,
  AqicnComparisonMetrics,
  AQICNStation,
} from "@/components/aqicn-comparison";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

export default function Home() {
  const [query, setQuery] = useState("");
  const [date, setDate] = useState<Date>();
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedApi, setSelectedApi] = useState("");

  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openSenseLoading, setOpenSenseLoading] = useState(false);
  const [viewVisual, setViewVisual] = useState("");
  const [viewPolluntant, setViewPolluntant] = useState("");
  const [viewExternal, setViewExternal] = useState("");
  const [openAQLoading, setOpenAQLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNavPad, setShowNavPad] = useState(false);
  const [activePopup, setActivePopup] = useState<mapboxgl.Popup | null>(null);

  // --- State for Aston Query ---
  const [astonDate, setAstonDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [hour, setHour] = useState<number>(10); // Existing state, reused
  const [astonAvgMethod, setAstonAvgMethod] = useState<string>("mean");
  const [astonSensorData, setAstonSensorData] = useState<any>(null); // Holds fetched Aston GeoJSON
  const [isAstonLoading, setIsAstonLoading] = useState<boolean>(false);

  const ASTON_POLLUTANT_PROPERTY_MAP: {
    [key: string]: keyof AstonFeatureProperties | null;
  } = {
    pm25: "particulatePM2.5_mean",
    pm10: "particulatePM10_mean",
    temp: "ambTempC_mean",
    humidity: "ambHumidity_mean",
    aqi: null,
    o3: null,
    no2: null,
    so2: null,
    co: null,
  };

  type OpenAQPollutant = keyof typeof OPENAQ_POLLUTANT_MAP;

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapContainerRef = useRef(null);
  let popup: mapboxgl.Popup | null = null;

  const openSenseManagerRef = useRef<OpenSenseDataManager | null>(null);

  const [activePopups, setActivePopups] = useState<mapboxgl.Popup[]>([]);
  const [comparisonData, setComparisonData] = useState<{
    firstStation: AQICNStation | null;
    secondStation: AQICNStation | null;
  }>({ firstStation: null, secondStation: null });

  useEffect(() => {
    // Separate OpenSense initialization
    // In the useEffect initialization
    const initializeOpenSenseData = async () => {
      try {
        setOpenSenseLoading(true);
        openSenseManagerRef.current = new OpenSenseDataManager();
        if (openSenseManagerRef.current) {
          console.log("Initializing OpenSense data...");
          // Initialize both PM types
          await Promise.all([
            openSenseManagerRef.current.initializeData("PM2.5"),
            openSenseManagerRef.current.initializeData("PM10"),
          ]);
        }
      } finally {
        setOpenSenseLoading(false);
      }
    };

    // Start OpenSense initialization immediately
    initializeOpenSenseData();

    // Map initialization (separate from OpenSense)
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

    if (!mapRef.current && mapContainerRef.current) {
      setLoading(true);
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/shuayb0/cm72r31yk002t01r0ed5mg628",
        center: [-1.88994, 52.48259],
        zoom: 13,
        dragRotate: true, // Enable drag-to-rotate
        touchPitch: true, // Enable touch-to-pitch
      });

      mapRef.current.on("style.load", () => {
        setIsStyleLoaded(true);
      });

      mapRef.current.on("load", () => {
        setLoading(false);
        if (!mapRef.current || !isStyleLoaded) return;
        fetchMapData();
      });

      if (mapRef.current) {
        mapRef.current.on("moveend", handleMoveEnd);
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.off("moveend", handleMoveEnd);
        mapRef.current.remove();
      }
    };
  }, []);

  const fetchMapData = async () => {
    if (!mapRef.current || selectedApi === "other") return;

    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    let fetchedStations: Station[] = [];

    if (selectedApi === "aqicn" && viewPolluntant === "aqi") {
      fetchedStations = await fetchAQICNData({
        lat1: bounds.getSouthWest().lat,
        lng1: bounds.getSouthWest().lng,
        lat2: bounds.getNorthEast().lat,
        lng2: bounds.getNorthEast().lng,
      });
    } else if (
      selectedApi === "opensense" &&
      (viewPolluntant === "pm25" || viewPolluntant === "pm10")
    ) {
      const phenomenon = viewPolluntant === "pm25" ? "PM2.5" : "PM10";
      if (openSenseManagerRef.current) {
        fetchedStations = await openSenseManagerRef.current.getVisibleStations(
          phenomenon
        );
      }
    } else if (selectedApi === "openweather") {
      const center = mapRef.current.getCenter();
      fetchedStations = await fetchOpenWeatherData({
        lat: center.lat,
        lon: center.lng,
      });
    }
    setStations(fetchedStations);
  };

  const clearMapLayers = () => {
    if (!mapRef.current || !isStyleLoaded) return;
    const map = mapRef.current; // Use map variable

    const layers = [
      "stations-circles",
      "stations-extrusions",
      "iqair-circle",
      "opensensemap-circle",
      "opensensemap-extrusions",
      "openaqmap-circle",
      "openaqmap-extrusions",
      "openweather-circle",
      "openweather-extrusion",
      "openaq-so2-layer", // Example, ensure all specific OpenAQ layers listed if not using prefix
      "openweather-wind-layer", // Added wind layer
      "aston-sensor-layer-3d", // <<-- Add Aston Layer ID
      "aqicn-heatmap",
    ];
    const sources = [
      "stations",
      "iqair-station",
      "opensensemap-stations",
      "openaqmap-stations",
      "openweather-station",
      "openaq-so2-source", // Example
      "openweather-wind-source", // Added wind source
      "aston-sensor-source",
      "aqicn-heatmap-source", // <<-- Add Aston Source ID
    ];

    console.log("[clearMapLayers] Attempting to remove layers/sources.");

    layers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        console.log(`[clearMapLayers] Removing layer: ${layerId}`);
        map.removeLayer(layerId);
      }
    });

    sources.forEach((sourceId) => {
      if (map.getSource(sourceId)) {
        console.log(`[clearMapLayers] Removing source: ${sourceId}`);
        map.removeSource(sourceId);
      }
    });

    // Keep the dynamic OpenAQ removal as a fallback/complement
    const style = map.getStyle();
    if (style && style.layers) {
      for (let i = style.layers.length - 1; i >= 0; i--) {
        const layer = style.layers[i];
        // Make sure not to remove the newly added aston layer if this runs unexpectedly
        if (
          layer.id.startsWith("openaq-") &&
          layer.id !== "aston-sensor-layer"
        ) {
          if (map.getLayer(layer.id)) {
            console.log(
              `[clearMapLayers] Removing dynamic OpenAQ layer: ${layer.id}`
            );
            map.removeLayer(layer.id);
          }
        }
      }
    }
    if (style && style.sources) {
      Object.keys(style.sources).forEach((sourceId) => {
        // Make sure not to remove the newly added aston source if this runs unexpectedly
        if (
          sourceId.startsWith("openaq-") &&
          sourceId !== "aston-sensor-source"
        ) {
          if (map.getSource(sourceId)) {
            console.log(
              `[clearMapLayers] Removing dynamic OpenAQ source: ${sourceId}`
            );
            map.removeSource(sourceId);
          }
        }
      });
    }
    console.log("[clearMapLayers] Finished removing layers/sources.");
  };

  useEffect(() => {
    if (stations.length > 0 || astonSensorData) {
      addMapCircles();
    } else {
      console.log(
        "[Effect Update] Clearing layers because no stations or Aston data."
      );
      clearMapLayers();
    }
  }, [
    selectedApi,
    viewVisual,
    viewPolluntant,
    stations, // Dependency for non-Aston APIs
    astonSensorData, // <<-- It's here, which is good!
    hour, // Aston hour dependency
    isStyleLoaded, // Ensures style is ready
    mapRef, // Ensures map is initialized (though mapRef itself doesn't change)
  ]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.off("moveend", handleMoveEnd);
    }

    if (selectedApi === "other") {
      clearMapLayers();
      setStations([]);
    } else if (selectedApi === "openaq") {
      clearMapLayers();
      setStations([]);
      setOpenAQLoading(true); // Show loading state for OpenAQ

      // Validate pollutant exists in OpenAQ mapping
      if (!(viewPolluntant in OPENAQ_POLLUTANT_MAP)) {
        setOpenAQLoading(false);
        return;
      }

      // Get numeric parameter ID
      const parameterId =
        OPENAQ_POLLUTANT_MAP[viewPolluntant as OpenAQPollutant];

      fetchOpenAQData(parameterId)
        .then(setStations)
        .catch(console.error)
        .finally(() => setOpenAQLoading(false));
    } else if (selectedApi === "iqair") {
      clearMapLayers(); // Clear
      setStations([]);
      if (mapRef.current) {
        const center = mapRef.current.getCenter();
        fetchIQAIRData({
          lat: center.lat,
          lon: center.lng,
        }).then((stations) => {
          setStations(stations);
        });
      }
    } else if (selectedApi === "aqicn") {
      clearMapLayers();
      setStations([]);
      fetchMapData();
      if (mapRef.current) {
        mapRef.current.on("moveend", handleMoveEnd);
      }
    } else {
      clearMapLayers();
      setStations([]);
      fetchMapData();
      if (mapRef.current) {
        mapRef.current.on("moveend", handleMoveEnd);
      }
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.off("moveend", handleMoveEnd);
      }
    };
  }, [selectedApi, viewPolluntant]);

  // Add this new useEffect for periodic refresh
  useEffect(() => {
    if (selectedApi !== "opensense") return;

    const intervalId = setInterval(async () => {
      if (openSenseManagerRef.current) {
        await openSenseManagerRef.current.forceRefresh("PM10");
        await openSenseManagerRef.current.forceRefresh("PM2.5");
        fetchMapData();
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [selectedApi, viewPolluntant]);

  const addMapCircles = async () => {
    if (!mapRef.current || !isStyleLoaded) return;
    const map = mapRef.current; // Use map variable for brevity

    if (selectedApi === "aston") {
      if (!astonSensorData) {
        console.log("No Aston data available");
        return;
      }

      AstonMapLayer(
        mapRef.current,
        astonSensorData,
        hour,
        astonDate,
        isStyleLoaded,

        (newPopup) => {
          setActivePopup((prev) => {
            prev?.remove();
            return newPopup;
          });
        }
      );
    } else if (selectedApi === "aqicn") {
      clearMapLayers();

      if (viewVisual === "3d") {
        AQICNMap3D(mapRef.current, stations, isStyleLoaded, (newPopup) => {
          popup = newPopup;
          setTimeout(() => popup?.addTo(mapRef.current!), 50);
        });
      } else if (viewVisual === "coloured") {
        AQICNMapCircles(mapRef.current, stations, isStyleLoaded, (newPopup) => {
          popup = newPopup;
          setTimeout(() => popup?.addTo(mapRef.current!), 50);
        });
      } else if (viewVisual === "heatmap") {
        AQICNMapHeatmap(mapRef.current, stations, isStyleLoaded, (newPopup) => {
          popup = newPopup;
          setTimeout(() => popup?.addTo(mapRef.current!), 50);
        });
      }
      return;
    }

    if (selectedApi === "iqair") {
      clearMapLayers();
      IQAirMapCircles(mapRef.current, stations, isStyleLoaded, (newPopup) => {
        popup = newPopup;
      });
    } else if (selectedApi === "opensense") {
      clearMapLayers();

      const currentPhenomenon = viewPolluntant === "pm10" ? "PM10" : "PM2.5";
      if (viewVisual === "coloured") {
        OpenSenseMapCircles(
          mapRef.current,
          stations,
          isStyleLoaded,
          currentPhenomenon,
          (newPopup) => {
            popup = newPopup;
          }
        );
      } else if (viewVisual === "3d") {
        OpenSenseMap3D(
          mapRef.current,
          stations,
          isStyleLoaded,
          currentPhenomenon,
          (newPopup) => {
            popup = newPopup;
          }
        );
      }
    } else if (selectedApi === "openaq") {
      clearMapLayers();

      if (viewVisual === "coloured") {
        OpenAQMapCircles(
          mapRef.current,
          stations,
          isStyleLoaded,
          viewPolluntant,
          (newPopup) => {
            popup = newPopup;
          }
        );
      } else if (viewVisual === "3d") {
        OpenAQMap3D(
          mapRef.current,
          stations,
          isStyleLoaded,
          viewPolluntant,
          (newPopup) => {
            popup = newPopup;
          }
        );
      } else if (viewVisual === "heatmap") {
        OpenAQMapHeatmap(
          mapRef.current,
          stations,
          isStyleLoaded,
          viewPolluntant
        );
      }
      return;
    } else if (selectedApi === "openweather") {
      clearMapLayers();
      if (viewVisual === "coloured") {
        const cleanup = OpenWeatherMapCircles(
          mapRef.current,
          stations,
          isStyleLoaded,
          viewPolluntant,
          (newPopup) => {
            if (activePopup) activePopup.remove();
            setActivePopup(newPopup);
          }
        );

        return cleanup;
      } else if (viewVisual === "3d") {
        OpenWeatherMap3D(
          mapRef.current,
          stations,
          isStyleLoaded,
          viewPolluntant,
          (newPopup) => {
            if (activePopup) activePopup.remove();
            setActivePopup(newPopup);
          }
        );
      }
      return;
    }
  };

  const handleMoveEnd = createThrottledMoveHandler(fetchMapData);

  const handleApiChange = (value: string) => {
    setSelectedApi(value);
  };

  const handleZoomIn = () => {
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.flyTo({
        zoom: currentZoom + 1,
        speed: 1.5,
        curve: 1.42,
      });
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.flyTo({
        zoom: currentZoom - 1,
        speed: 1.5,
        curve: 1.42,
      });
    }
  };

  function removeWindLayer(map: mapboxgl.Map) {
    const layerId = "openweather-wind-layer";
    const sourceId = "openweather-wind-source";

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }

  // Update view mode handler
  const handleViewVisualsChange = (value: string) => {
    setViewVisual(value);
    // Add your logic here to update the map visualization based on the selected view mode
  };

  const handleViewPolluntantChange = (value: string) => {
    setViewPolluntant(value);
    // Add your logic here to update the map visualization based on the selected view mode
  };

  const handleExternalFacChange = (value: string) => {
    setViewExternal(value);

    if (!mapRef.current || !isStyleLoaded) return;

    // If the user toggles 'wind', add the wind layer
    if (value === "wind") {
      console.log("Adding wind layer");
      addWindLayer(mapRef.current, isStyleLoaded);
    } else {
      // Otherwise, remove the wind layer if it exists
      removeWindLayer(mapRef.current);
    }
  };

  const viewVisuals = [
    { id: "coloured", label: "Data Circles" },
    { id: "3d", label: "3D" },
    { id: "heatmap", label: "Heatmap" },
    // Add new options here as needed
  ];

  const viewPollutants = [
    { id: "aqi", label: "AQI" },
    { id: "pm25", label: "PM2.5" },
    { id: "pm10", label: "PM10" },
    { id: "o3", label: "O3" },
    { id: "so2", label: "SO2" }, // Lowercase ID
    { id: "no2", label: "NO2" }, // Lowercase ID
    { id: "co", label: "CO" }, // Lowercase ID
  ];

  const viewExternalFact = [
    { id: "wind", label: "Wind" },

    // Add new options here as needed
  ];

  const handleSearch = async () => {
    if (!mapRef.current || !query) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json?access_token=${mapboxgl.accessToken}`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: 13,
          essential: true,
        });
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
  };

  function handleReset() {
    // Example: return map to a default center (lng, lat) and zoom
    mapRef.current?.flyTo({
      center: [-1.88994, 52.48259],
      zoom: 13,
      duration: 1000,
      bearing: 0,
      pitch: 0, // optional animation duration (ms)
    });
  }

  useEffect(() => {
    return () => {
      activePopups.forEach((popup) => popup.remove());
    };
  }, [activePopups]);

  useEffect(() => {
    const handleCompare = (e: CustomEvent) => {
      setComparisonData((prev) => {
        if (!prev.firstStation) {
          return { ...prev, firstStation: e.detail };
        }
        return { ...prev, secondStation: e.detail };
      });
    };

    window.addEventListener("compareStation", handleCompare as EventListener);
    return () =>
      window.removeEventListener(
        "compareStation",
        handleCompare as EventListener
      );
  }, []);

  return (
    <>
      <section className="flex-1 bg-zinc-800 flex justify-center pl-4 pb-4">
        <div className="relative w-full h-full">
          <div
            id="map-container"
            ref={mapContainerRef}
            className="w-full h-full bg-zinc-700 rounded-2xl"
          ></div>

          {/* Search container: top-left */}
          <div className="absolute top-4 left-4 flex gap-2 items-center">
            {/* Search control */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="bg-zinc-800 text-white p-2 rounded-full shadow-md hover:bg-zinc-700"
            >
              <Search className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  key="search-input"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "12rem", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search location..."
                    className="bg-white rounded-full shadow-md w-full"
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    onBlur={() => setShowSearch(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Left-side middle container for Aston Form */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-64 pointer-events-none">
            {/* Conditional Aston University Form */}
            {selectedApi === "aston" && (
              <div className="bg-zinc-700/90 backdrop-blur-sm border border-zinc-600 rounded-2xl p-3 shadow-xl pointer-events-auto">
                <div className="space-y-3">
                  {/* Date Picker */}
                  <div>
                    <label
                      htmlFor="aston-start-date"
                      className="block text-xs font-medium text-zinc-300 mb-1"
                    >
                      Select Date
                    </label>
                    <Input
                      id="aston-start-date"
                      type="date"
                      name="start"
                      value={astonDate} // <-- Set value from state
                      onChange={(e) => setAstonDate(e.target.value)} // <-- Add onChange handler
                      className="w-full bg-zinc-800 border-zinc-600 text-white rounded-md text-sm p-1.5 h-8" // Adjusted style from previous review
                      disabled={isAstonLoading}
                    />
                    <p className="text-xs text-zinc-400 mt-1">
                      Fetches 24hr data starting this date.
                    </p>
                  </div>

                  {/* Hour Slider */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Select Hour:{" "}
                      <span className="ml-1 text-blue-400">
                        {String(hour).padStart(2, "0")}
                      </span>
                    </label>
                    <Slider
                      defaultValue={[12]}
                      max={23}
                      min={0}
                      step={1}
                      className="w-full"
                      value={[hour]}
                      onValueChange={(value) => setHour(value[0])}
                    />
                    <div className="flex justify-between text-[0.6rem] text-zinc-400 mt-1">
                      <span>00</span>
                      <span>23</span>
                    </div>
                  </div>

                  {/* Averaging Method */}
                  <div>
                    <label
                      htmlFor="aston-avg-method"
                      className="block text-xs font-medium text-zinc-300 mb-1"
                    >
                      Averaging Method
                    </label>
                    <Select
                      value={astonAvgMethod} // <-- Set value from state
                      onValueChange={setAstonAvgMethod} // <-- Add onValueChange handler
                      disabled={isAstonLoading}
                    >
                      <SelectTrigger
                        id="aston-avg-method"
                        className="w-full bg-zinc-800 border-zinc-600 text-white rounded-md text-sm p-1.5 h-8"
                      >
                        {" "}
                        {/* Added id, adjusted style */}
                        <SelectValue placeholder="Method..." />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 text-white border-zinc-600">
                        {/* Keep SelectItems as they are */}
                        <SelectItem
                          value="mean"
                          className="focus:bg-zinc-700 cursor-pointer text-sm"
                        >
                          Mean
                        </SelectItem>
                        <SelectItem
                          value="median"
                          className="focus:bg-zinc-700 cursor-pointer text-sm"
                        >
                          Median
                        </SelectItem>
                        <SelectItem
                          value="max"
                          className="focus:bg-zinc-700 cursor-pointer text-sm"
                        >
                          Max
                        </SelectItem>
                        <SelectItem
                          value="min"
                          className="focus:bg-zinc-700 cursor-pointer text-sm"
                        >
                          Min
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Query Button */}
                  <Button
                    onClick={async () => {
                      setIsAstonLoading(true);
                      const astonAvgFrequency = "H"; // Assuming hourly frequency for now

                      const data = await fetchAstonData({
                        startDate: astonDate,
                        averagingMethod: astonAvgMethod,
                        averagingFrequency: astonAvgFrequency,
                      });

                      setAstonSensorData(data); // Update state with the result (GeoJSON or null)
                      setIsAstonLoading(false); // Set loading false after fetch completes

                      // Note: The map update will be triggered by the useEffect watching astonSensorData
                    }}
                    disabled={isAstonLoading || !astonDate}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 text-white text-sm h-8"
                  >
                    {isAstonLoading ? (
                      <span className="animate-pulse">Loading...</span>
                    ) : (
                      "Query Aston Data"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {/* Container for nav pad on the left and zoom/compass on the right */}
          <div className="absolute top-4 right-4 flex items-start space-x-2">
            {/* Nav pad (appears on the left when showNavPad is true) */}
            <AnimatePresence>
              {showNavPad && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="flex flex-col items-center space-y-1"
                >
                  <button
                    onClick={() => {
                      const center = mapRef.current?.getCenter();
                      center &&
                        mapRef.current?.easeTo({
                          pitch: 60,
                        });
                    }}
                    className="bg-zinc-800 text-white p-2 rounded-full shadow-md hover:bg-zinc-700"
                  >
                    <ArrowBigUp className="h-5 w-5" />
                  </button>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => {
                        const center = mapRef.current?.getCenter();
                        center &&
                          mapRef.current?.easeTo({
                            bearing: mapRef.current.getBearing() - 30,
                          });
                      }}
                      className="bg-zinc-800 text-white p-2 rounded-full shadow-md hover:bg-zinc-700"
                    >
                      <ArrowBigLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        const center = mapRef.current?.getCenter();
                        center &&
                          mapRef.current?.easeTo({
                            bearing: mapRef.current.getBearing() + 30,
                          });
                      }}
                      className="bg-zinc-800 text-white p-2 rounded-full shadow-md hover:bg-zinc-700"
                    >
                      <ArrowBigRight className="h-5 w-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      const center = mapRef.current?.getCenter();
                      center &&
                        mapRef.current?.easeTo({
                          pitch: 0,
                        });
                    }}
                    className="bg-zinc-800 text-white p-2 rounded-full shadow-md hover:bg-zinc-700"
                  >
                    <ArrowBigDown className="h-5 w-5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Zoom in/out + Compass (vertical stack on the right) */}
            <div className="flex flex-col space-y-1">
              {/* Zoom controls */}
              <button
                onClick={handleZoomIn}
                className="bg-zinc-800 text-white p-2 rounded-full shadow-md hover:bg-zinc-700"
              >
                <CirclePlus className="h-5 w-5" />
              </button>
              <button
                onClick={handleZoomOut}
                className="bg-zinc-800 text-white p-2 rounded-full shadow-md hover:bg-zinc-700"
              >
                <CircleMinus className="h-5 w-5" />
              </button>

              {/* Compass control */}
              <button
                onClick={() => setShowNavPad(!showNavPad)}
                className="bg-zinc-800 text-white p-2 rounded-full shadow-md hover:bg-zinc-700"
              >
                <Compass className="h-5 w-5" />
              </button>

              {/* Reset button */}
              <button
                onClick={handleReset}
                className="bg-zinc-800 text-white p-2 rounded-full shadow-md hover:bg-zinc-700"
              >
                <LocateFixed className="h-5 w-5" />
              </button>
            </div>
          </div>

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 rounded-xl">
              <Spinner className="h-12 w-12 border-zinc-200" />
            </div>
          )}

          {selectedApi === "opensense" && openSenseLoading && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-zinc-800/90 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 z-20">
              <Spinner className="h-[1rem] w-[1rem] border-zinc-100" />
              <span className="text-zinc-300 animate-pulse">
                Initialising OpenSense data...
              </span>
            </div>
          )}
          {selectedApi === "openaq" && openAQLoading && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-zinc-800/90 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 z-20">
              <Spinner className="h-[1rem] w-[1rem] border-zinc-100" />
              <span className="text-zinc-300 animate-pulse">
                Initializing OpenAQ data...
              </span>
            </div>
          )}
        </div>
      </section>

      <aside className="w-[25rem] bg-zinc-800 pt-0 px-4 pb-4 flex flex-col items-start">
        <div className="w-full h-full p-6 bg-zinc-700 rounded-2xl flex flex-col items-start">
          <Tabs defaultValue="query" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4 bg-zinc-800 gap-1 p-1">
              <TabsTrigger
                value="query"
                className="data-[state=active]:bg-zinc-600 data-[state=active]:text-white text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                Query
              </TabsTrigger>
              <TabsTrigger
                value="compare"
                className="data-[state=active]:bg-zinc-600 data-[state=active]:text-white text-zinc-300 hover:text-zinc-100 transition-colors"
              >
                Compare
              </TabsTrigger>
            </TabsList>

            {/* Query Tab Content */}
            <TabsContent value="query" className="w-full">
              <div className="w-full h-full mt-4 space-y-4">
                <div className="w-full h-full mt-4">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Air Quality Layers [Sources]
                  </label>
                  <Select onValueChange={handleApiChange}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aqicn">AQICN</SelectItem>
                      <SelectItem value="opensense">OpenSense</SelectItem>
                      <SelectItem value="openaq">OpenAQ</SelectItem>
                      <SelectItem value="aston">Aston University</SelectItem>
                      <SelectItem value="openweather">
                        <div className="flex items-center gap-2">
                          OpenWeather
                          <Badge variant="secondary" className="text-xs">
                            Limited
                          </Badge>
                        </div>
                      </SelectItem>
                      {/**      <SelectItem value="iqair">
                        <div className="flex items-center gap-2">
                          IQAIR
                          <Badge variant="secondary" className="text-xs">
                            Limited
                          </Badge>
                        </div>
                      </SelectItem>*/}
                      <SelectItem value="other">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    View Mode
                  </label>
                  <ToggleGroup
                    type="single"
                    value={viewVisual}
                    onValueChange={handleViewVisualsChange}
                    size="sm"
                    className="text-white [&>*]:border-[3px] [&>*]:border-zinc-600"
                    variant="outline"
                  >
                    {viewVisuals.map(({ id, label }) => (
                      <ToggleGroupItem
                        key={id}
                        value={id}
                        className="flex-1 data-[state=on]:bg-zinc-400"
                        disabled={
                          (selectedApi === "openweather" && id == "heatmap") ||
                          (selectedApi === "aston" && id !== "3d")
                        }
                      >
                        {label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    External Factors
                  </label>
                  <ToggleGroup
                    type="single"
                    value={viewExternal}
                    onValueChange={handleExternalFacChange}
                    size="sm"
                    className="text-white [&>*]:border-[3px] [&>*]:border-zinc-600"
                    variant="outline"
                  >
                    {viewExternalFact.map(({ id, label }) => (
                      <ToggleGroupItem
                        key={id}
                        value={id}
                        className="flex-1 data-[state=on]:bg-zinc-400"
                      >
                        {label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    View Pollutants
                  </label>
                  <ToggleGroup
                    type="single"
                    value={viewPolluntant}
                    onValueChange={handleViewPolluntantChange}
                    size="sm"
                    className="text-white text-xs [&>*]:border-[3px] [&>*]:border-zinc-600"
                    variant="outline"
                    defaultValue="aqi"
                  >
                    {viewPollutants.map(({ id, label }) => (
                      <ToggleGroupItem
                        key={id}
                        value={id}
                        className="flex-1 text-xs data-[state=on]:bg-zinc-400"
                        disabled={
                          (selectedApi === "aqicn" && id !== "aqi") ||
                          (selectedApi === "opensense" &&
                            !["pm25", "pm10"].includes(id)) ||
                          (selectedApi === "openweather" &&
                            ![
                              "pm25",
                              "pm10",
                              "o3",
                              "no2",
                              "so2",
                              "co",
                            ].includes(id)) ||
                          selectedApi === "aston"
                        }
                      >
                        {label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                {/* <div className="mt-4">
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Historical Query
                  </label>
                  <div className="space-y-2">
                    <DatePickerWithRange />

                    <div className="flex items-center space-x-2">
                      
                      <Select>
                        <SelectTrigger className="w-[50%] bg-white">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aqicn">AQICN</SelectItem>
                          <SelectItem value="iqair">IQAIR</SelectItem>
                          <SelectItem value="opensense">OpenSense</SelectItem>
                          <SelectItem value="openaq">OpenAQ</SelectItem>
                          <SelectItem value="openweather">
                            OpenWeather
                          </SelectItem>
                          <SelectItem value="other">None</SelectItem>
                        </SelectContent>
                      </Select>

                      
                      <Button className="w-[50%]">Query</Button>
                    </div>
                  </div>
                </div> */}
              </div>
            </TabsContent>

            {/* Compare Tab Content */}
            <TabsContent value="compare" className="w-full h-full">
              <div className=" flex flex-col p-4 bg-zinc-800 rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-zinc-100">
                    Air Quality Comparison
                  </h2>
                  <button
                    onClick={() =>
                      setComparisonData({
                        firstStation: null,
                        secondStation: null,
                      })
                    }
                    className="text-sm bg-red-800 hover:bg-red-700 text-white px-3 py-1 rounded-lg flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                </div>

                {/* Single scrollable container */}
                <div className="flex-1 overflow-y-auto space-y-6">
                  {comparisonData.firstStation ||
                  comparisonData.secondStation ? (
                    <div className="space-y-6">
                      {/* Stations Row */}
                      <div className="grid grid-cols-2 gap-3">
                        {comparisonData.firstStation && (
                          <div className="bg-zinc-700 p-2 rounded-lg">
                            <AqicnStationCard
                              station={comparisonData.firstStation}
                              onClear={() =>
                                setComparisonData((prev) => ({
                                  ...prev,
                                  firstStation: null,
                                }))
                              }
                            />
                          </div>
                        )}

                        {comparisonData.secondStation && (
                          <div className="bg-zinc-700 p-2 rounded-lg">
                            <AqicnStationCard
                              station={comparisonData.secondStation}
                              onClear={() =>
                                setComparisonData((prev) => ({
                                  ...prev,
                                  secondStation: null,
                                }))
                              }
                            />
                          </div>
                        )}
                      </div>

                      {/* Comparison Metrics - Only shown when both selected */}
                      {comparisonData.firstStation &&
                        comparisonData.secondStation && (
                          <div className="bg-zinc-700 p-4 rounded-lg">
                            <AqicnComparisonMetrics
                              stationA={comparisonData.firstStation}
                              stationB={comparisonData.secondStation}
                            />
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
                      Select stations to compare using the "Compare" buttons on
                      the map
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </aside>
    </>
  );
}
