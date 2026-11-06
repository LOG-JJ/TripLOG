const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const saved = new Map();
const context = vm.createContext({
  window: { TripLog: { register() {} } },
  state: { city: "서울", country: "대한민국" },
  isValidLatLng: (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180,
  normalizePlaceAlias: value => String(value).replace(/\s+/g, "").toLowerCase(),
  findItineraryItem: id => saved.get(id),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/app/services/maps/query-utils.js"), "utf8"), context);
context.buildTripDestinationQuery = () => "서울 대한민국";

function fixture() {
  const item = { id: "palace", place: "경복궁", location: "서울 종로구", lat: 37.5796, lon: 126.977,
    coordinateSource: "coordinate-text", coordinatePrecision: "exact", coordinateAddress: "서울 종로구", googlePlaceId: "saved-place" };
  item.coordinateSignature = context.buildItemCoordinateSignature(item);
  return item;
}

// Reusing resolved route points must not make trusted coordinates disappear on reload.
let item = fixture();
context.cacheItemCoordinates(item, { lat: item.lat, lon: item.lon });
assert.equal(item.coordinateSource, "coordinate-text");
assert.equal(item.coordinatePrecision, "exact");
assert.equal(item.googlePlaceId, "saved-place");

// A newly resolved position must not inherit the old place's trust or identity.
item = fixture();
context.cacheItemCoordinates(item, { lat: 37.57, lon: 127.01 });
assert.equal(item.coordinateSource, "");
assert.equal(item.googlePlaceId, "");

// Matching coordinates alone are insufficient when the place description changed.
item = fixture(); item.place = "다른 장소";
context.cacheItemCoordinates(item, { lat: item.lat, lon: item.lon });
assert.equal(item.coordinateSource, "");

// An explicit new provider takes precedence over cached metadata.
item = fixture();
context.cacheItemCoordinates(item, { lat: item.lat, lon: item.lon, source: "google-places", placeId: "new-place", precision: "rooftop" });
assert.equal(item.coordinateSource, "google-places");
assert.equal(item.googlePlaceId, "new-place");
assert.equal(item.coordinatePrecision, "rooftop");

// A detached lookup object still updates the matching saved record consistently.
item = fixture(); saved.set(item.id, item);
context.cacheItemCoordinates({ ...item }, { lat: item.lat, lon: item.lon });
assert.equal(saved.get(item.id).coordinateSource, "coordinate-text");
assert.equal(saved.get(item.id).coordinateSignature, context.buildItemCoordinateSignature(item));
console.log("PASS: 5 coordinate provenance regression cases");
