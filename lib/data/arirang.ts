/**
 * Official Arirang World Tour (2026–2027) events and cities.
 * Source: https://en.wikipedia.org/wiki/Arirang_World_Tour
 */

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
