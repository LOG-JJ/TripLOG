const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "XK",
  "YE", "YT",
  "ZA", "ZM", "ZW",
];

const COUNTRY_NAME_OVERRIDES = {
  CD: "콩고민주공화국",
  CG: "콩고공화국",
  CZ: "체코",
  FK: "포클랜드 제도",
  GB: "영국",
  KR: "대한민국",
  KP: "북한",
  LA: "라오스",
  MK: "북마케도니아",
  MM: "미얀마",
  PS: "팔레스타인",
  RU: "러시아",
  SZ: "에스와티니",
  TW: "대만",
  US: "미국",
  XK: "코소보",
};

const COUNTRY_ALIAS_OVERRIDES = {
  CN: ["중국", "china", "中国"],
  GB: ["영국", "uk", "united kingdom", "britain", "great britain"],
  JP: ["일본", "japan", "日本"],
  KR: ["대한민국", "한국", "korea", "south korea"],
  RU: ["러시아", "russia"],
  TW: ["대만", "taiwan", "台灣", "台湾"],
  US: ["미국", "usa", "united states", "america"],
};

const countryNameKo = typeof Intl !== "undefined" && Intl.DisplayNames
  ? new Intl.DisplayNames(["ko-KR"], { type: "region" })
  : null;
const countryNameEn = typeof Intl !== "undefined" && Intl.DisplayNames
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

function getCountryFlag(code = "") {
  const normalized = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "🌐";
  return normalized
    .split("")
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join("");
}

function getCountryFlagImageUrl(code = "") {
  const normalized = String(code || "").toLowerCase();
  if (!/^[a-z]{2}$/.test(normalized)) return "";
  return `https://flagcdn.com/w40/${normalized}.png`;
}

function normalizeCountrySearchText(value = "") {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function buildCountryDatabase() {
  return COUNTRY_CODES
    .map((code) => {
      const name = COUNTRY_NAME_OVERRIDES[code] || countryNameKo?.of(code) || code;
      const englishName = countryNameEn?.of(code) || "";
      const aliases = COUNTRY_ALIAS_OVERRIDES[code] || [];
      const keywords = [code, name, englishName, ...aliases]
        .filter(Boolean)
        .map(normalizeCountrySearchText);
      return {
        code,
        flag: getCountryFlag(code),
        flagImage: getCountryFlagImageUrl(code),
        name,
        englishName,
        keywords,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
}

const COUNTRY_DATABASE = buildCountryDatabase();

function getCountryDatabase() {
  return COUNTRY_DATABASE;
}

function findCountryByCode(code = "") {
  const normalized = String(code || "").toUpperCase();
  return COUNTRY_DATABASE.find((country) => country.code === normalized) || null;
}

function findCountryByName(value = "") {
  const query = normalizeCountrySearchText(value);
  if (!query) return null;
  return COUNTRY_DATABASE.find((country) => country.keywords.some((keyword) => keyword === query)) || null;
}

function searchCountries(value = "") {
  const query = normalizeCountrySearchText(value);
  if (!query) return COUNTRY_DATABASE;

  const startsWith = [];
  const contains = [];
  COUNTRY_DATABASE.forEach((country) => {
    const hasStart = country.keywords.some((keyword) => keyword.startsWith(query));
    const hasContain = country.keywords.some((keyword) => keyword.includes(query));
    if (hasStart) startsWith.push(country);
    else if (hasContain) contains.push(country);
  });

  return [...startsWith, ...contains];
}

window.TripLog.register("data.countries", {
  COUNTRY_CODES,
  getCountryDatabase,
  getCountryFlag,
  getCountryFlagImageUrl,
  normalizeCountrySearchText,
  findCountryByCode,
  findCountryByName,
  searchCountries,
});
