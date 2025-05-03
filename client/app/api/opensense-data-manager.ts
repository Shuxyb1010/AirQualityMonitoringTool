// lib/actions/opensense-data-manager.ts
import { Station } from "../../lib/actions/map.actions";
import { fetchOpenSenseData } from "../../lib/actions/source.actions";

type Phenomenon = "PM2.5" | "PM10";

interface OpenSenseDataManagerConfig {
  refreshInterval: number;
  maxCacheAge: number;
}

interface CachedData {
  stations: Station[];
  timestamp: number;
}

export class OpenSenseDataManager {
  private cache: Record<Phenomenon, Station[]> = {
    "PM2.5": [],
    PM10: [],
  };
  private lastFetchTimes: Record<Phenomenon, number> = {
    "PM2.5": 0,
    PM10: 0,
  };
  private isFetching: Record<Phenomenon, boolean> = {
    "PM2.5": false,
    PM10: false,
  };

  constructor(
    private config: OpenSenseDataManagerConfig = {
      refreshInterval: 10 * 60 * 1000, // 10 minutes
      maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  ) {}

  async initializeData(phenomenon: Phenomenon): Promise<void> {
    const cachedData = this.getCachedData(phenomenon);
    if (cachedData && this.isCacheValid(cachedData)) {
      this.cache[phenomenon] = cachedData.stations;
      return;
    }

    await this.fetchStations(phenomenon);
  }

  private getCachedData(phenomenon: Phenomenon): CachedData | null {
    if (typeof window === "undefined") return null;
    const cached = localStorage.getItem(`openSenseStations-${phenomenon}`);
    return cached ? JSON.parse(cached) : null;
  }

  private isCacheValid(cachedData: CachedData): boolean {
    const now = Date.now();
    return (
      now - cachedData.timestamp < this.config.maxCacheAge &&
      cachedData.stations.length > 0
    );
  }

  private async fetchStations(phenomenon: Phenomenon): Promise<void> {
    if (this.isFetching[phenomenon]) return;

    this.isFetching[phenomenon] = true;
    try {
      const stations = await fetchOpenSenseData(phenomenon);
      this.cache[phenomenon] = stations;

      if (typeof window !== "undefined") {
        localStorage.setItem(
          `openSenseStations-${phenomenon}`,
          JSON.stringify({
            stations,
            timestamp: Date.now(),
          })
        );
      }

      this.lastFetchTimes[phenomenon] = Date.now();
    } catch (error) {
      console.error(`Failed to fetch ${phenomenon} stations:`, error);
    } finally {
      this.isFetching[phenomenon] = false;
    }
  }

  async getVisibleStations(phenomenon: Phenomenon): Promise<Station[]> {
    await this.backgroundRefresh(phenomenon);
    return this.cache[phenomenon];
  }

  private async backgroundRefresh(phenomenon: Phenomenon): Promise<void> {
    const now = Date.now();
    if (now - this.lastFetchTimes[phenomenon] > this.config.refreshInterval) {
      await this.fetchStations(phenomenon);
    }
  }

  async forceRefresh(phenomenon: Phenomenon): Promise<void> {
    await this.fetchStations(phenomenon);
  }

  // For combined operations
  async refreshAll(): Promise<void> {
    await Promise.all([
      this.fetchStations("PM2.5"),
      this.fetchStations("PM10"),
    ]);
  }
}
