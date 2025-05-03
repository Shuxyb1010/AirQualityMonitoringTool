"use client";

import { useState } from "react"; // <-- Import useState
import {
  LayoutDashboard,
  Map,
  Info,
  ArrowLeft, // <-- Import ArrowLeft
  ArrowRight, // <-- Import ArrowRight
} from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter, // <-- Import DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button"; // <-- Import Button

const mainNav = [
  { name: "Map", href: "#", icon: Map },
  { name: "Information", href: "#", icon: Info },
];

// --- Content Components for Pagination ---

// Content for Page 1 (General Info + Sources)
const Page1Content = () => (
  <div className="py-1 space-y-2 text-sm text-zinc-300 max-h-[60vh] overflow-y-auto pr-2">
    {" "}
    {/* Adjusted padding/margins slightly */}
    <p>
      Welcome to AirQual, your platform for monitoring air quality data around
      the world & Aston University.
    </p>
    <p className="font-medium text-zinc-100 pt-1">Data Sources:</p>
    <ul className="list-disc list-inside pl-4 text-zinc-400 space-y-1">
      <li>
        <span className="font-semibold text-zinc-300">AQICN:</span> Near
        real-time data fetching.
      </li>
      <li>
        <span className="font-semibold text-zinc-300">OpenSense:</span>{" "}
        Available pollutants PM2.5 and PM10. Slow initial API requests, refresh
        every 10min.
      </li>
      <li>
        <span className="font-semibold text-zinc-300">OpenAQ:</span> All
        pollutants available except AQI. API requests can be slow.
      </li>
      <li>
        <span className="font-semibold text-zinc-300">
          Aston University (Local):
        </span>{" "}
        University/surrounding area data only. Quick API requests.
      </li>
      <li>
        <span className="font-semibold text-zinc-300">
          OpenWeather (Limited):
        </span>{" "}
        Single point request due to rate limits and available API. AQI & Heatmap
        not available due to constraints.
      </li>
      <li>
        <span className="font-semibold text-zinc-300">IQAIR (Limited):</span>{" "}
        Single point request due to rate limits and available API
      </li>
    </ul>
    <p className="pt-2">
      Use the map to explore near real-time data points in various visuals. The
      comparison tool allows side-by-side analysis of different locations. Click
      on a marker to showcase popup with detailed information.
    </p>
    <p className="pt-2 text-xs text-zinc-500">
      Developed in Birmingham, UK. Current time:{" "}
      {new Date().toLocaleString("en-GB", {
        timeZone: "Europe/London",
        dateStyle: "medium",
        timeStyle: "short",
      })}
      .
    </p>
  </div>
);

// Content for Page 2 (Visual Descriptions)
const Page2Content = () => (
  <div className="py-1 space-y-3 text-sm text-zinc-300 max-h-[60vh] overflow-y-auto pr-2">
    {" "}
    {/* Adjusted padding/margins slightly */}
    <p className="font-medium text-zinc-100">Visualization Types:</p>
    <div className="space-y-2 pl-2">
      <p>
        <span className="font-semibold text-zinc-200">Data-Driven Circles</span>{" "}
        Available to all API's. Represents data using circles plotted at sensor
        locations. Where the colour of each circle correspond to measured
        pollution level (Red = High, Green = Low). This visualization helps
        users identify specific hotspots and trends in air quality data.
      </p>
      <p>
        <span className="font-semibold text-zinc-200">3D Columns/Bars:</span>{" "}
        Visualizes data by extruding 3D bars vertically at each senosr location.
        Height and colour represent pollution intensity, offering a volumetric
        perspective. Impactful with 3D building layers to understand pollution.
      </p>
      <p>
        <span className="font-semibold text-zinc-200">Heatmap:</span> Generates
        a color gradient overlay illustrating pollution distribution across an
        area by interpolating data to create a continuous surface, effectively
        highlighting pollution hotspots. (Yellow/Purple) and cleaner areas
        (Green). spatial trends and regional air quality patterns rather than
        focusing on individual station readings.{" "}
        <span className="text-xs text-zinc-500">
          (Not available for limited APIs like OpenWeather/IQAIR).
        </span>
      </p>
    </div>
  </div>
);

// --- NavBar Component ---

export default function NavBar() {
  // --- State for Pagination ---
  const [dialogPage, setDialogPage] = useState(1);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);

  return (
    <header className="w-full h-20 px-4 flex items-center justify-between bg-zinc-800 text-white">
      {/* Logo and Title */}
      <Link href="/" className="flex items-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-8 w-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* SVG paths */}
          <path
            d="M3 8H10C11.6569 8 13 6.65685 13 5C13 3.34315 11.6569 2 10 2C8.34315 2 7 3.34315 7 5"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 16H15C16.6569 16 18 17.3431 18 19C18 20.6569 16.6569 22 15 22C13.3431 22 12 20.6569 12 19"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 12H19C20.6569 12 22 10.6569 22 9C22 7.34315 20.6569 6 19 6C17.3431 6 16 7.34315 16 9"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="ml-2 text-xl font-bold">AirQual</span>
      </Link>

      {/* Navigation Buttons */}
      <nav className="flex space-x-4">
        {mainNav.map((item) => {
          // --- Special handling for the Information button ---
          if (item.name === "Information") {
            return (
              // Use controlled Dialog state
              <Dialog
                key={item.name}
                open={isInfoDialogOpen}
                onOpenChange={(open) => {
                  setIsInfoDialogOpen(open);
                  // Reset to page 1 when closing
                  if (!open) {
                    setDialogPage(1);
                  }
                }}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <button
                          className="flex items-center justify-center space-x-2 px-4 py-2 h-12 w-12 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition duration-200"
                          aria-label={item.name}
                        >
                          <item.icon size={20} />
                        </button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* --- Dialog Content with Pagination --- */}
                <DialogContent className="sm:max-w-lg bg-zinc-800 border-zinc-700 text-zinc-200 flex flex-col">
                  {" "}
                  {/* Use flex column, slightly wider */}
                  <DialogHeader>
                    {/* Dynamic Title */}
                    <DialogTitle className="text-white">
                      {dialogPage === 1
                        ? "Information"
                        : "Visualization Details"}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 pt-1">
                      {dialogPage === 1
                        ? "About AirQual and data sources."
                        : "How data is displayed on the map."}
                    </DialogDescription>
                  </DialogHeader>
                  {/* Conditionally render content based on page state */}
                  <div className="flex-grow min-h-0 my-2">
                    {" "}
                    {/* Added margin, Allow content to take space and scroll */}
                    {/* Use the content components defined above */}
                    {dialogPage === 1 && <Page1Content />}
                    {dialogPage === 2 && <Page2Content />}
                  </div>
                  {/* Footer with Navigation Buttons */}
                  <DialogFooter className="pt-2 mt-auto flex justify-between sm:justify-between w-full">
                    {" "}
                    {/* Adjusted padding */}
                    {/* Show Previous Button only on Page 2 */}
                    {dialogPage === 2 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDialogPage(1)}
                        className="text-zinc-300 border-zinc-600 hover:bg-zinc-700 hover:text-white"
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" /> Prev
                      </Button>
                    ) : (
                      <div></div> // Placeholder to maintain spacing
                    )}
                    {/* Show Next Button only on Page 1 */}
                    {dialogPage === 1 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDialogPage(2)}
                        className="text-zinc-300 border-zinc-600 hover:bg-zinc-700 hover:text-white"
                      >
                        Next <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <div></div> // Placeholder
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            );
          }

          // Default rendering for other nav items
          return (
            <TooltipProvider key={item.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className="flex items-center justify-center space-x-2 px-4 py-2 h-12 w-12 rounded-lg bg-zinc-700 hover:bg-zinc-600 transition duration-200"
                    aria-label={item.name}
                  >
                    <item.icon size={20} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{item.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </nav>
    </header>
  );
}
