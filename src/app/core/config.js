const STORAGE_KEY = "domesticTravelExpensePlanner.v1";
const HISTORY_STORAGE_KEY = "domesticTravelExpensePlanner.history.v1";
const GOOGLE_GEOCODING_API_KEY_STORAGE_KEY = "domesticTravelExpensePlanner.googleGeocodingApiKey.v1";
const PAGE_TRANSITION_MS = 800;
const TIME_EDGE_SCROLL_DURATION = 560;
const TIME_WHEEL_SCROLL_DURATION = 180;
const TIME_WHEEL_SCROLL_FACTOR = 0.38;
const DAY_STRIP_EDGE_SCROLL_DURATION = 460;
const DAY_STRIP_DRAG_THRESHOLD = 12;
const GEOCODE_TIMEOUT_MS = 4500;
const ROUTE_SEGMENT_TIMEOUT_MS = 6500;
const PRE_TRIP_EXPENSE_DATE = "__pretrip__";
const PRE_TRIP_EXPENSE_LABEL = "사전구매";
const PRE_TRIP_EXPENSE_SHORT_DATE = "여행 전";
const PRE_TRIP_EXPENSE_WEEKDAY = "결제";

const knownPlaceCoordinates = [
  { aliases: ["제주국제공항", "제주 공항", "jeju international airport"], context: "제주", lat: 33.5070711, lon: 126.4916441 },
  { aliases: ["코델리아s호텔", "코델리아 s호텔", "코델리아s", "cordelia s hotel"], context: "제주", lat: 33.454925, lon: 126.9102771 },
  { aliases: ["광치기해변", "광치기 해변", "gwangchigi beach"], context: "제주", lat: 33.4537662, lon: 126.9255233 },
  { aliases: ["성산일출봉", "seongsan ilchulbong"], context: "제주", lat: 33.4588891, lon: 126.9408178 },
  { aliases: ["우도", "udo island"], context: "제주", lat: 33.5072572, lon: 126.9550015 },
];

const categories = [
  { name: "숙소", color: "#ccb7ff" },
  { name: "식비", color: "#ffe45c" },
  { name: "관광", color: "#6ee7b7" },
  { name: "교통", color: "#fda4af" },
  { name: "쇼핑", color: "#7dd3fc" },
  { name: "기타", color: "#cbd5e1" },
];

const currencies = [
  { code: "JPY", symbol: "¥", unit: "엔", label: "엔화", rateBase: 100 },
  { code: "USD", symbol: "$", unit: "달러", label: "달러", rateBase: 1 },
  { code: "CNY", symbol: "¥", unit: "위안", label: "위안화", rateBase: 1 },
  { code: "EUR", symbol: "€", unit: "유로", label: "유로", rateBase: 1 },
  { code: "GBP", symbol: "£", unit: "파운드", label: "파운드", rateBase: 1 },
  { code: "TWD", symbol: "NT$", unit: "대만달러", label: "대만달러", rateBase: 1 },
  { code: "THB", symbol: "฿", unit: "바트", label: "바트", rateBase: 1 },
  { code: "VND", symbol: "₫", unit: "동", label: "베트남동", rateBase: 100 },
];

window.TripLog.register("core.config", {
  STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  GOOGLE_GEOCODING_API_KEY_STORAGE_KEY,
  PAGE_TRANSITION_MS,
  TIME_EDGE_SCROLL_DURATION,
  TIME_WHEEL_SCROLL_DURATION,
  TIME_WHEEL_SCROLL_FACTOR,
  DAY_STRIP_EDGE_SCROLL_DURATION,
  DAY_STRIP_DRAG_THRESHOLD,
  GEOCODE_TIMEOUT_MS,
  ROUTE_SEGMENT_TIMEOUT_MS,
  PRE_TRIP_EXPENSE_DATE,
  PRE_TRIP_EXPENSE_LABEL,
  PRE_TRIP_EXPENSE_SHORT_DATE,
  PRE_TRIP_EXPENSE_WEEKDAY,
  knownPlaceCoordinates,
  categories,
  currencies,
});
