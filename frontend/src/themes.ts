import type { ThemeKey } from "@blogging-app/common";

export type ThemePalette = {
  key: ThemeKey;
  label: string;
  accent: string;
  border: string;
  softBg: string;
  postBg: string;
  profileBg: string;
  text: string;
};

export const THEME_PALETTES: ThemePalette[] = [
  {
    key: "boring-grey",
    label: "Boring Grey",
    accent: "#64748b",
    border: "#cbd5e1",
    softBg: "#f8fafc",
    postBg: "#f1f5f9",
    profileBg: "#f8fafc",
    text: "#334155",
  },
  {
    key: "sunset",
    label: "Sunset Ember",
    accent: "#dc2626",
    border: "#f97316",
    softBg: "#fff7ed",
    postBg: "#ffedd5",
    profileBg: "#fff7ed",
    text: "#7c2d12",
  },
  {
    key: "purple",
    label: "Purple Bloom",
    accent: "#7e22ce",
    border: "#c084fc",
    softBg: "#faf5ff",
    postBg: "#f3e8ff",
    profileBg: "#faf5ff",
    text: "#581c87",
  },
  {
    key: "forest",
    label: "Forest Moss",
    accent: "#15803d",
    border: "#22c55e",
    softBg: "#f0fdf4",
    postBg: "#dcfce7",
    profileBg: "#f0fdf4",
    text: "#14532d",
  },
  {
    key: "ocean",
    label: "Ocean Breeze",
    accent: "#0369a1",
    border: "#0ea5e9",
    softBg: "#f0f9ff",
    postBg: "#e0f2fe",
    profileBg: "#f0f9ff",
    text: "#0c4a6e",
  },
  {
    key: "rose",
    label: "Rose Garden",
    accent: "#be185d",
    border: "#f472b6",
    softBg: "#fdf2f8",
    postBg: "#fce7f3",
    profileBg: "#fdf2f8",
    text: "#831843",
  },
  {
    key: "indigo",
    label: "Indigo Night",
    accent: "#4338ca",
    border: "#818cf8",
    softBg: "#eef2ff",
    postBg: "#e0e7ff",
    profileBg: "#eef2ff",
    text: "#312e81",
  },
  {
    key: "gold",
    label: "Golden Hour",
    accent: "#a16207",
    border: "#eab308",
    softBg: "#fefce8",
    postBg: "#fef3c7",
    profileBg: "#fefce8",
    text: "#713f12",
  },
];

export const DEFAULT_THEME_KEY: ThemeKey = "boring-grey";

const THEME_BY_KEY = new Map<ThemeKey, ThemePalette>(
  THEME_PALETTES.map((theme) => [theme.key, theme])
);

export function getThemePalette(themeKey?: string | null) {
  return THEME_BY_KEY.get((themeKey as ThemeKey) || DEFAULT_THEME_KEY) ?? THEME_BY_KEY.get(DEFAULT_THEME_KEY)!;
}
