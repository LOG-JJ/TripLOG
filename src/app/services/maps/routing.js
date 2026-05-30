async function buildRouteLatLngs(validItems, renderToken) {
  const latlngs = [];
  let routedSegments = 0;
  let fallbackSegments = 0;

  for (let i = 0; i < validItems.length - 1; i++) {
    const from = validItems[i];
    const to = validItems[i + 1];
    const profile = getRouteProfileForTransit(to.item.trans || from.item.trans);
    const segmentLatLngs = await fetchRouteSegmentFromOsrm(from, to, profile);
    if (renderToken !== leafletRenderToken) return { cancelled: true };

    if (segmentLatLngs.length >= 2) {
      appendLatLngSegment(latlngs, segmentLatLngs);
      routedSegments++;
    } else {
      appendLatLngSegment(latlngs, [[from.lat, from.lon], [to.lat, to.lon]]);
      fallbackSegments++;
    }
  }

  return { latlngs, routedSegments, fallbackSegments };
}

async function fetchRouteSegmentFromOsrm(from, to, profile) {
  try {
    const url = new URL(`https://router.project-osrm.org/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}`);
    url.searchParams.set("overview", "full");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("alternatives", "false");
    url.searchParams.set("steps", "false");

    const res = await fetchWithTimeout(url.toString(), {
      headers: { Accept: "application/json" },
    }, ROUTE_SEGMENT_TIMEOUT_MS);
    if (!res.ok) throw new Error(`osrm ${res.status}`);

    const data = await res.json();
    const coordinates = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates)) return [];

    return coordinates
      .map(([lon, lat]) => [parseFloat(lat), parseFloat(lon)])
      .filter(([lat, lon]) => isValidLatLng(lat, lon));
  } catch (e) {
    console.error("Route calculation failed:", from.item?.place, to.item?.place, e);
    return [];
  }
}

function getRouteProfileForTransit(trans) {
  return trans === "walk" ? "foot" : "driving";
}

function appendLatLngSegment(target, segment) {
  segment.forEach((latlng, index) => {
    if (index === 0 && target.length > 0) return;
    target.push(latlng);
  });
}


window.TripLog.register("services.maps.routing", {
  buildRouteLatLngs,
  fetchRouteSegmentFromOsrm,
  getRouteProfileForTransit,
  appendLatLngSegment,
});
