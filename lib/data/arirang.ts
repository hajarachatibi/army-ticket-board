/**
 * Official Arirang World Tour (2026–2027) events and cities.
 * Source: https://en.wikipedia.org/wiki/Arirang_World_Tour
 */

// (deploy trigger)
export const ARIRANG_EVENT_NAME = "Arirang World Tour" as const;

/** Canonical event options for dropdowns. */
export const ARIRANG_EVENTS = [ARIRANG_EVENT_NAME] as const;

/** All Arirang tour cities (promotional names: Las Vegas, Paris, Los Angeles). Sorted A–Z. */
export const ARIRANG_CITIES = [
  "Arlington",
  "Bangkok",
  "Baltimore",
  "Bogotá",
  "Brussels",
  "Busan",
  "Buenos Aires",
  "Chicago",
  "East Rutherford",
  "El Paso",
  "Foxborough",
  "Goyang",
  "Hong Kong",
  "Jakarta",
  "Kaohsiung",
  "Kuala Lumpur",
  "Las Vegas",
  "Lima",
  "London",
  "Los Angeles",
  "Madrid",
  "Manila",
  "Melbourne",
  "Mexico City",
  "Munich",
  "Paris",
  "Santiago",
  "Singapore",
  "São Paulo",
  "Stanford",
  "Sydney",
  "Tampa",
  "Tokyo",
  "Toronto",
] as const;

export type ArirangEvent = (typeof ARIRANG_EVENTS)[number];
export type ArirangCity = (typeof ARIRANG_CITIES)[number];

/** Continent for each Arirang city (for listing filters). */
export const ARIRANG_CITY_CONTINENT: Record<string, string> = {
  Arlington: "North America",
  Bangkok: "Asia",
  Baltimore: "North America",
  Bogotá: "South America",
  Brussels: "Europe",
  Busan: "Asia",
  "Buenos Aires": "South America",
  Chicago: "North America",
  "East Rutherford": "North America",
  "El Paso": "North America",
  Foxborough: "North America",
  Goyang: "Asia",
  "Hong Kong": "Asia",
  Jakarta: "Asia",
  Kaohsiung: "Asia",
  "Kuala Lumpur": "Asia",
  "Las Vegas": "North America",
  Lima: "South America",
  London: "Europe",
  "Los Angeles": "North America",
  Madrid: "Europe",
  Manila: "Asia",
  Melbourne: "Oceania",
  "Mexico City": "North America",
  Munich: "Europe",
  Paris: "Europe",
  Santiago: "South America",
  Singapore: "Asia",
  "São Paulo": "South America",
  Stanford: "North America",
  Sydney: "Oceania",
  Tampa: "North America",
  Tokyo: "Asia",
  Toronto: "North America",
};

/** Unique continents for Arirang cities, sorted. */
export const ARIRANG_CONTINENTS = [
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
] as const;

export type ArirangContinent = (typeof ARIRANG_CONTINENTS)[number];

/** Get continent for a city name (e.g. from a listing). */
export function getContinentForCity(city: string): string | null {
  if (!city || typeof city !== "string") return null;
  const t = city.trim();
  return ARIRANG_CITY_CONTINENT[t] ?? null;
}
