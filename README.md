# AirQualityMonitoringTool
University Final Year Project 
This Air Quality Monitoring Tool successfully integrates data from various sources and presents it in an interactive web application. Users can select any source to view current air quality information around the world. For each source, the application presents visuals, external factors and pollutant querying. The data-driven circles colour reflects pollutant levels, using a defined boundaries to indicate severity, likewise 3D visual does the same with additional extrusion length to indicate levels offering a more immersive understanding. The implementation ensures the extrusion remains clear even with extruded buildings. Heatmap alludes to the aggregated view of AQ, where darker hotspots indicate more sensors and higher levels. Smoothing individual sensor readings into a gradient, signifying trends. The tool design was met great positivity. A dark themed look where every text and component has placed delicately, considering clarity and distinction. 

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


Additionally, create an .env file with your own API Keys
```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=
NEXT_PUBLIC_AQICN_API_KEY=
NEXT_PUBLIC_IQAIR_API_KEY=
NEXT_PUBLIC_OPENAQ_API_KEY=
NEXT_PUBLIC_OPENWEATHER_API_KEY=
NEXT_PUBLIC_AIRQUALITY_API_URL=
```

- Request Access to the Demo Server at https://cors-anywhere.herokuapp.com/corsdemo for OPENAQ Requests
