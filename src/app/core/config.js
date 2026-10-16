const STORAGE_KEY = "domesticTravelExpensePlanner.v1";
const HISTORY_STORAGE_KEY = "domesticTravelExpensePlanner.history.v1";
const GOOGLE_GEOCODING_API_KEY_STORAGE_KEY = "domesticTravelExpensePlanner.googleGeocodingApiKey.v1";

const DAY_STRIP_EDGE_SCROLL_DURATION = 460;
const DAY_STRIP_DRAG_THRESHOLD = 12;
const GEOCODE_TIMEOUT_MS = 4500;

const PRE_TRIP_EXPENSE_DATE = "__pretrip__";
const PRE_TRIP_EXPENSE_LABEL = "사전구매";
const PRE_TRIP_EXPENSE_SHORT_DATE = "여행 전";
const PRE_TRIP_EXPENSE_WEEKDAY = "결제";

const categories = window.TripLog.data.expenseCategories.list('legacy');

function getCategory(name) {
  return categories.find((category) => category.name === name) || categories.at(-1);
}

const currencies = [
  { code: "JPY", symbol: "¥", unit: "엔", label: "엔화", rateBase: 100 },
  { code: "KRW", symbol: "₩", unit: "원", label: "원화", rateBase: 1 },
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
  DAY_STRIP_EDGE_SCROLL_DURATION,
  DAY_STRIP_DRAG_THRESHOLD,
  GEOCODE_TIMEOUT_MS,
  PRE_TRIP_EXPENSE_DATE,
  PRE_TRIP_EXPENSE_LABEL,
  PRE_TRIP_EXPENSE_SHORT_DATE,
  PRE_TRIP_EXPENSE_WEEKDAY,
  categories,
  getCategory,
  currencies,
});
