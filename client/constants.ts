export const OPENAQ_POLLUTANT_MAP = {
  pm10: 1,
  pm25: 2,
  o3: 3,
  co: 8,
  no2: 5,
  so2: 6,
} as const;

export type OpenAQPollutant = keyof typeof OPENAQ_POLLUTANT_MAP;
export type OpenAQParameterId = (typeof OPENAQ_POLLUTANT_MAP)[OpenAQPollutant];
