function formatWon(value) {
  return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

const commaNumberInputConfigs = new WeakMap();

function parseFormattedNumber(value) {
  const normalized = String(value ?? "")
    .replaceAll(",", "")
    .replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === "." || normalized === "-.") return 0;
  return Number(normalized) || 0;
}

function sanitizeCommaNumberText(value, { allowDecimal = false, maxFractionDigits = 0 } = {}) {
  let text = String(value ?? "").replaceAll(",", "").replace(/[^\d.]/g, "");
  if (!text) return "";

  if (!allowDecimal) {
    text = text.split(".")[0];
  } else {
    const [integerPart, ...decimalParts] = text.split(".");
    const decimalText = decimalParts.join("").slice(0, maxFractionDigits);
    text = decimalParts.length > 0 ? `${integerPart}.${decimalText}` : integerPart;
  }

  if (!text || text === ".") return allowDecimal && text === "." ? "0." : "";

  const hasDecimal = allowDecimal && text.includes(".");
  const [integerPart, decimalPart = ""] = text.split(".");
  const cleanedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  return hasDecimal ? `${cleanedInteger}.${decimalPart}` : cleanedInteger;
}

function formatNumberWithCommas(value, options = {}) {
  const config = {
    allowDecimal: false,
    maxFractionDigits: 0,
    ...options,
  };
  const sanitized = sanitizeCommaNumberText(value, config);
  if (!sanitized) return "";

  const hasDecimal = config.allowDecimal && sanitized.includes(".");
  const [integerPart, decimalPart = ""] = sanitized.split(".");
  const formattedInteger = Number(integerPart || 0).toLocaleString("ko-KR");
  return hasDecimal ? `${formattedInteger}.${decimalPart}` : formattedInteger;
}

function formatCommaNumberInput(input) {
  if (!input) return;
  const config = commaNumberInputConfigs.get(input) || {};
  const oldValue = input.value;
  const oldCursor = input.selectionStart ?? oldValue.length;
  const formatted = formatNumberWithCommas(oldValue, config);
  input.value = formatted;

  if (document.activeElement === input && typeof input.setSelectionRange === "function") {
    const cursor = Math.max(0, oldCursor + formatted.length - oldValue.length);
    input.setSelectionRange(cursor, cursor);
  }
}

function setCommaNumberInputValue(input, value) {
  if (!input) return;
  const isEmpty = value === "" || value === null || value === undefined;
  input.value = isEmpty ? "" : formatNumberWithCommas(value, commaNumberInputConfigs.get(input) || {});
}

function setupCommaNumberInput(input, options = {}) {
  if (!input) return;
  const config = {
    allowDecimal: false,
    maxFractionDigits: 0,
    ...options,
  };
  commaNumberInputConfigs.set(input, config);
  input.type = "text";
  input.inputMode = config.allowDecimal ? "decimal" : "numeric";
  input.autocomplete = "off";
  input.dataset.commaNumberInput = "true";

  if (!input.dataset.commaNumberListenerAttached) {
    input.addEventListener("input", () => formatCommaNumberInput(input));
    input.addEventListener("blur", () => formatCommaNumberInput(input));
    input.dataset.commaNumberListenerAttached = "true";
  }
  setCommaNumberInputValue(input, input.value);
}

function setupCommaNumberInputs(inputs, options = {}) {
  (Array.isArray(inputs) ? inputs : Array.from(inputs || [])).forEach((input) => setupCommaNumberInput(input, options));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.TripLog.register("shared.formatters", {
  formatWon,
  parseFormattedNumber,
  formatNumberWithCommas,
  formatCommaNumberInput,
  setCommaNumberInputValue,
  setupCommaNumberInput,
  setupCommaNumberInputs,
  escapeHtml,
});
