/**
 * "Made for" setting: Nigerian learners or learners anywhere.
 * The guide is added to every AI prompt that writes words a learner sees or hears.
 */
export type LocaleStyle = "ng" | "intl";

export const LOCALE_OPTIONS: { id: LocaleStyle; label: string; help: string }[] = [
  {
    id: "ng",
    label: "Nigerian learners",
    help: "Nigerian English, Nigerian accent, and examples from everyday Nigerian life",
  },
  {
    id: "intl",
    label: "Learners anywhere",
    help: "International English and everyday examples from anywhere",
  },
];

export function localeGuide(locale: LocaleStyle) {
  if (locale === "ng") {
    return [
      "The learner is a Nigerian child at a Nigerian school.",
      "Use Nigerian English: British spelling (colour, favourite, metre), and words Nigerian children use, such as 'pupil', 'primary school', 'JSS', 'mummy', 'aunty', 'naira', 'bus stop', 'okada'.",
      "Pick examples and images from everyday Nigerian life: jollof rice, puff-puff, suya, garri, danfo buses, generators, harmattan, rainy season, football, Nollywood, market traders, Lagos traffic, family gatherings.",
      "Use Nigerian names for characters, such as Chidi, Amaka, Tunde, Aisha, Emeka, Bisi, Musa, Zainab.",
      "Avoid American words and settings (no 'candy', 'soccer', 'mom', 'dollars', 'Thanksgiving', 'snow day').",
      "Keep it warm, respectful and fun, never stereotyped. Do not use Pidgin unless the learner's own material does.",
    ].join(" ");
  }
  return "Use clear international English and everyday examples most children around the world would know.";
}
