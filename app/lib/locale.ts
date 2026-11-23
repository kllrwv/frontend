import translations from "../translations.json";
export type Lang = keyof typeof translations;
export const copy = { ru: translations.ru.site, en: translations.en.site };
export function storedLanguage(): Lang {
  try {
    return localStorage.getItem("killerwave.lang") === "en" ? "en" : "ru";
  } catch {
    return "ru";
  }
}
