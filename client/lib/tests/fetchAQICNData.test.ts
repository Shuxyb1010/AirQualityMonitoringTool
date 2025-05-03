import { fetchAQICNData } from "../actions/source.actions"; // The module under test

/**
 * Bounds fixture used in all tests
 */
const BOUNDS_FIXTURE = {
  lat1: 34.05, // Los Angeles SW corner
  lng1: -118.25,
  lat2: 34.15, // Los Angeles NE corner
  lng2: -118.15,
};

describe("fetchAQICNData", () => {
  afterEach(() => {
    // Make sure we remove any mock so the next test starts clean
    jest.resetAllMocks();
  });

  it("returns an array of Station objects on a successful 200 response", async () => {
    // ---- Arrange ----------------------------------------------------------
    const mockApiPayload = {
      status: "ok",
      data: [
        {
          uid: 1234,
          lat: 34.1,
          lon: -118.2,
          aqi: "42",
          iaqi: { pm25: { v: 18 } },
          station: { name: "LA-Downtown" },
        },
      ],
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockApiPayload),
      } as Response)
    ) as jest.Mock;

    // ---- Act --------------------------------------------------------------
    const result = await fetchAQICNData(BOUNDS_FIXTURE);

    // ---- Assert -----------------------------------------------------------
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      uid: "1234",
      name: "LA-Downtown",
      aqi: 42,
      pollutants: { pm25: 18 },
    });
  });

  it("returns an empty array when the server responds with non-200", async () => {
    // ---- Arrange ----------------------------------------------------------
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        text: () => Promise.resolve("Internal Server Error"),
      } as Response)
    ) as jest.Mock;

    // ---- Act --------------------------------------------------------------
    const result = await fetchAQICNData(BOUNDS_FIXTURE);

    // ---- Assert -----------------------------------------------------------
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]); // should gracefully degrade
  });

  it("returns an empty array when the fetch call rejects (network error)", async () => {
    // ---- Arrange ----------------------------------------------------------
    global.fetch = jest.fn(() =>
      Promise.reject(new Error("network down"))
    ) as jest.Mock;

    // ---- Act --------------------------------------------------------------
    const result = await fetchAQICNData(BOUNDS_FIXTURE);

    // ---- Assert -----------------------------------------------------------
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });
});
