# Air Quality Monitoring Tool

A comprehensive web-based air quality monitoring and visualization platform that aggregates data from multiple air quality APIs and provides interactive mapping capabilities with real-time data visualization.
<img width="726" height="343" alt="image" src="https://github.com/user-attachments/assets/c0c1a853-b7c2-416e-a2e6-7d5b615c5369" />
<img width="740" height="391" alt="image" src="https://github.com/user-attachments/assets/6e17640e-a945-415e-a564-63092d8115ee" />
<img width="740" height="338" alt="image" src="https://github.com/user-attachments/assets/8f72e5db-0086-469c-9fa6-3ddd2ea1747e" />
<img width="740" height="350" alt="image" src="https://github.com/user-attachments/assets/32ed52ec-4884-4a11-8a98-31a6d3f09bb3" />
<img width="344" height="513" alt="image" src="https://github.com/user-attachments/assets/78d4abf2-7ea6-4193-a580-e99d06ef9e9b" />
<img width="460" height="264" alt="image" src="https://github.com/user-attachments/assets/ff41d0d2-32e5-45f2-8867-5c010971df41" />
<img width="735" height="393" alt="image" src="https://github.com/user-attachments/assets/e6504472-f501-42df-89ab-176857b009d0" />
<img width="740" height="390" alt="image" src="https://github.com/user-attachments/assets/21a6bda0-990e-4653-b180-70fbcd99ca55" />






## 📋 Description

This air quality monitoring tool is a Next.js-based web application that provides real-time air quality data visualization through interactive maps. The system integrates multiple air quality data sources including AQICN, IQAir, OpenSense, OpenAQ, and OpenWeather APIs to provide comprehensive air quality monitoring capabilities.

The application features an interactive map interface powered by Mapbox GL JS, allowing users to visualize air quality data through various visualization methods including circles, 3D extrusions, and heatmaps. Users can compare data from different sources, filter by pollutants, and analyze historical trends.

### Visualization Capabilities

The Air Quality Monitoring Tool successfully integrates data from various sources and presents it in an interactive web application. Users can select any source to view current air quality information around the world. For each source, the application presents visuals, external factors and pollutant querying.

**Data-Driven Visualizations:**

- **Circle Overlays**: Color-coded circles reflect pollutant levels using defined boundaries to indicate severity
- **3D Extrusions**: Enhanced visualization with extrusion length indicating levels, offering a more immersive understanding while ensuring clarity even with extruded buildings
- **Heatmaps**: Aggregated view of air quality where darker hotspots indicate more sensors and higher levels, smoothing individual sensor readings into a gradient that signifies trends

### User Experience & Design

The tool design was met with great positivity, featuring a dark-themed interface where every text and component is placed delicately, considering clarity and distinction. The implementation ensures optimal user experience with smooth interactions and intuitive navigation.

## 🚀 Features

### Core Features

- **Multi-Source Data Integration**: Aggregates data from 5+ air quality APIs
- **Interactive Map Visualization**: Real-time air quality data on interactive maps
- **Multiple Visualization Modes**:
  - Circle overlays with color-coded AQI values
  - 3D extrusion maps for enhanced spatial visualization
  - Heatmap visualization for density analysis
- **Real-time Data Updates**: Automatic data refresh and caching system
- **Location-based Search**: Search and navigate to specific locations
- **Pollutant Filtering**: Filter data by specific pollutants (PM2.5, PM10, O3, NO2, SO2, CO)

### Advanced Features

- **Data Comparison**: Compare air quality data between different sources and locations
- **Historical Data Analysis**: View and analyze historical air quality trends
- **Wind Layer Integration**: Visualize wind patterns and their impact on air quality
- **Responsive Design**: Mobile-friendly interface with adaptive layouts
- **Data Caching**: Intelligent caching system for improved performance
- **Custom Date Range Selection**: Analyze data for specific time periods

### User Interface Features

- **Interactive Controls**: Zoom, pan, and navigation controls
- **Search Functionality**: Location-based search with autocomplete
- **Toggle Controls**: Easy switching between different data sources and visualization modes
- **Popup Information**: Detailed station information on map interactions
- **Loading States**: Visual feedback during data fetching operations

## 🛠️ Technologies Used

### Core Technologies

- **Next.js**: React framework with App Router
- **React**: UI library for component-based architecture
- **TypeScript**: Type-safe JavaScript development
- **Tailwind CSS**: Utility-first CSS framework

### Mapping & Visualization

- **Mapbox GL JS**: Interactive map rendering and visualization
- **@turf/turf**: Geospatial analysis and calculations

### UI Components

- **Radix UI**: Accessible component primitives (Dialog, Select, Tabs, etc.)
- **Framer Motion**: Animation library for smooth transitions
- **Lucide React**: Icon library

### Data & Utilities

- **date-fns**: Date manipulation and formatting
- **react-day-picker**: Date picker component

### Testing & Development

- **Jest**: Testing framework
- **ESLint**: Code linting and quality assurance

## 📦 Installation & Setup

### Prerequisites

- Node.js 18+
- npm or yarn package manager
- Mapbox API key (for map functionality)

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here
NEXT_PUBLIC_AQICN_API_KEY=your_aqicn_api_key_here
NEXT_PUBLIC_IQAIR_API_KEY=your_iqair_api_key_here
NEXT_PUBLIC_OPENAQ_API_KEY=your_openaq_api_key_here
NEXT_PUBLIC_OPENWEATHER_API_KEY=your_openweather_api_key_here
NEXT_PUBLIC_AIRQUALITY_API_URL=your_airquality_api_url_here
```

**Note**: You'll need to obtain API keys from the following services:

- **Mapbox**: [Get Mapbox Access Token](https://account.mapbox.com/access-tokens/)
- **AQICN**: [Get AQICN API Key](https://aqicn.org/data-platform/token/)
- **IQAir**: [Get IQAir API Key](https://www.iqair.com/air-pollution-data-api)
- **OpenAQ**: [Get OpenAQ API Key](https://docs.openaq.org/docs/getting-started)
- **OpenWeather**: [Get OpenWeather API Key](https://openweathermap.org/api)

Additionally, create an `.env` file with your own API Keys:

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=
NEXT_PUBLIC_AQICN_API_KEY=
NEXT_PUBLIC_IQAIR_API_KEY=
NEXT_PUBLIC_OPENAQ_API_KEY=
NEXT_PUBLIC_OPENWEATHER_API_KEY=
NEXT_PUBLIC_AIRQUALITY_API_URL=
```

### Installation Steps

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd air-quality-monitoring-tool
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**

   - Copy the example environment variables above
   - Add your API keys for the required services

4. **Run the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 Usage

### Basic Usage

1. **Load the Application**: Open the web application in your browser
2. **Select Data Source**: Choose from available air quality data sources (AQICN, IQAir, OpenSense, OpenAQ, OpenWeather)
3. **Choose Visualization**: Select between circle overlays, 3D extrusions, or heatmaps
4. **Filter Pollutants**: Use the pollutant filter to focus on specific air quality parameters
5. **Navigate the Map**: Use zoom controls, search functionality, or manual navigation

### Advanced Features

- **Data Comparison**: Select multiple stations to compare air quality metrics
- **Historical Analysis**: Use the date picker to analyze historical data
- **Wind Layer**: Toggle wind layer to understand air quality dispersion patterns
- **Search Locations**: Use the search bar to find specific cities or coordinates

### API Integration

The application integrates with the following air quality APIs:

- **AQICN**: Global air quality index data
- **IQAir**: Real-time air quality monitoring
- **OpenSense**: Open-source air quality sensor network
- **OpenAQ**: Open air quality data platform
- **OpenWeather**: Weather and air quality data

## 📊 Results & Analysis

### Data Visualization Methods

1. **Circle Overlays**: Color-coded circles representing AQI values at monitoring stations
2. **3D Extrusions**: Height-based visualization showing air quality intensity
3. **Heatmaps**: Density-based visualization for regional air quality patterns

### Metrics Tracked

- **Air Quality Index (AQI)**: Overall air quality assessment
- **PM2.5**: Fine particulate matter (≤2.5 μm)
- **PM10**: Coarse particulate matter (≤10 μm)
- **O3**: Ground-level ozone
- **NO2**: Nitrogen dioxide
- **SO2**: Sulfur dioxide
- **CO**: Carbon monoxide

### Data Quality Features

- **Real-time Updates**: Automatic data refresh every 10 minutes
- **Data Validation**: Quality checks for incoming data
- **Error Handling**: Graceful handling of API failures
- **Caching System**: Local storage for improved performance

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:cov     # Run tests with coverage
```

## 🚀 Deployment

### Production Build

```bash
npm run build
npm run start
```

---

**Note**: This application requires valid API keys for full functionality. Please ensure all required API keys are properly configured before use. And request Access to the Demo Server at https://cors-anywhere.herokuapp.com/corsdemo for OPENAQ Requests
