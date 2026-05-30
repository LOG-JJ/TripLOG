function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCategory(name) {
  return categories.find((category) => category.name === name) || categories.at(-1);
}

function describeDonutSlice(cx, cy, outerRx, outerRy, innerRx, innerRy, startAngle, endAngle) {
  const startOuter = pointOnEllipse(cx, cy, outerRx, outerRy, startAngle);
  const endOuter = pointOnEllipse(cx, cy, outerRx, outerRy, endAngle);
  const startInner = pointOnEllipse(cx, cy, innerRx, innerRy, startAngle);
  const endInner = pointOnEllipse(cx, cy, innerRx, innerRy, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRx} ${outerRy} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRx} ${innerRy} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
}

function describePieSlice(cx, cy, rx, ry, startAngle, endAngle) {
  const start = pointOnEllipse(cx, cy, rx, ry, startAngle);
  const end = pointOnEllipse(cx, cy, rx, ry, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${rx} ${ry} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function pointOnEllipse(cx, cy, rx, ry, degrees) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: roundPathNumber(cx + rx * Math.cos(radians)),
    y: roundPathNumber(cy + ry * Math.sin(radians)),
  };
}

function roundPathNumber(value) {
  return Number(value.toFixed(3));
}

function shadeColor(color, amount) {
  const hex = color.replace("#", "");
  const number = Number.parseInt(hex, 16);
  const red = clampColor((number >> 16) + amount);
  const green = clampColor(((number >> 8) & 255) + amount);
  const blue = clampColor((number & 255) + amount);
  return `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`;
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}

window.TripLog.register("shared.svgGeometry", {
  createId,
  getCategory,
  describeDonutSlice,
  describePieSlice,
  pointOnEllipse,
  roundPathNumber,
  shadeColor,
  clampColor,
});
