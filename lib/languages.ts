export type LangCode =
  | "en"
  | "zh"
  | "zh-TW"
  | "ja"
  | "ko"
  | "fr"
  | "de"
  | "es"
  | "ru"
  | "ar"
  | "pt"
  | "it"
  | "th"
  | "vi"
  | "hi";

export const LANGUAGES: ReadonlyArray<{
  code: LangCode;
  bcp47: string;
  englishName: string;
}> = [
  { code: "en", bcp47: "en-US", englishName: "English" },
  { code: "zh", bcp47: "zh-CN", englishName: "Chinese (Simplified)" },
  { code: "zh-TW", bcp47: "zh-TW", englishName: "Chinese (Traditional)" },
  { code: "ja", bcp47: "ja-JP", englishName: "Japanese" },
  { code: "ko", bcp47: "ko-KR", englishName: "Korean" },
  { code: "fr", bcp47: "fr-FR", englishName: "French" },
  { code: "de", bcp47: "de-DE", englishName: "German" },
  { code: "es", bcp47: "es-ES", englishName: "Spanish" },
  { code: "ru", bcp47: "ru-RU", englishName: "Russian" },
  { code: "ar", bcp47: "ar-SA", englishName: "Arabic" },
  { code: "pt", bcp47: "pt-BR", englishName: "Portuguese" },
  { code: "it", bcp47: "it-IT", englishName: "Italian" },
  { code: "th", bcp47: "th-TH", englishName: "Thai" },
  { code: "vi", bcp47: "vi-VN", englishName: "Vietnamese" },
  { code: "hi", bcp47: "hi-IN", englishName: "Hindi" },
];

export const LANGUAGE_BY_CODE: Record<LangCode, (typeof LANGUAGES)[number]> =
  Object.fromEntries(LANGUAGES.map((l) => [l.code, l])) as Record<
    LangCode,
    (typeof LANGUAGES)[number]
  >;
