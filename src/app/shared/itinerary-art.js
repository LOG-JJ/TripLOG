(function (root, factory) {
  const data = typeof module === 'object' && module.exports ? require('../data/itinerary-art') : root.TripLog.data.itineraryArt;
  const api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TripLog?.register('shared.itineraryArt', api);
})(typeof window === 'undefined' ? globalThis : window, function (data) {
  'use strict';
  const own = (map, key) => typeof key === 'string' && Object.hasOwn(map, key) ? map[key] : undefined;
  const normalize = value => String(value || '').normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC').toLocaleLowerCase('en').replace(/[_\-‐–—]+/gu, ' ').replace(/\s+/gu, ' ').trim();
  const rules = Object.entries(data.keywords).map(([id, words]) => ({ id, words: words.split('|').map(normalize) }));
  const wordCharacter = char => Boolean(char) && /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{N}]/u.test(char);
  function hasWord(name, word) {
    if (Array.from(word).length === 1 && !wordCharacter(word) && !name.endsWith(word)) return false;
    let at = name.indexOf(word);
    while (at >= 0) {
      const before = name[at - 1] || '', after = name[at + word.length] || '';
      // Latin/Cyrillic/Arabic matches need token boundaries: a "bar" must not
      // turn Barcelona into a pub. CJK/Thai compound names need substrings.
      if ((!wordCharacter(word[0]) || !wordCharacter(before)) && (!wordCharacter(word.at(-1)) || !wordCharacter(after))) return true;
      at = name.indexOf(word, at + 1);
    }
    return false;
  }
  function result(id, reason, theme) {
    const chosen = own(data.catalog, id) || data.catalog.travel;
    const fallback = data.catalog[data.fallbacks[theme] || data.fallbacks[chosen.group] || 'travel'];
    return { ...chosen, reason, fallbackSrc: fallback.src, universalSrc: data.catalog.travel.src, version: data.version };
  }
  function subtype(item = {}) {
    const chosen = own(data.catalog, item?.themeSubtype);
    return chosen?.group === (item?.theme || 'sightseeing') ? chosen : null;
  }
  function subtypes(theme) { return Object.values(data.catalog).filter(row => row.group === theme); }
  function presentation(item = {}) { return subtype(item) || own(data.themes, item?.theme) || data.themes.sightseeing; }
  function resolve(item = {}, trip = {}) {
    item = item && typeof item === 'object' ? item : {};
    const theme = Object.hasOwn(data.fallbacks, item.theme) ? item.theme : 'etc';
    const fallback = data.fallbacks[theme];
    const selected = subtype(item);
    if (selected) return result(selected.id, 'selected', theme);
    // Explicit reservation kind describes the event itself. Incoming transport
    // segments (item.trans/transits) are deliberately not used to classify POIs.
    if (theme === 'transport' || theme === 'etc') {
      const kind = item.transportReservation?.kind;
      const transport = own({ flight: 'airport', train: 'train', subway: 'train', bus: 'bus', ferry: 'ferry', car: 'car', taxi: 'car', bicycle: 'bicycle', walk: 'walk' }, kind);
      if (transport) return result(transport, 'reservation', theme);
    }
    // Optional provider metadata in imported records can strengthen selection;
    // no remote lookup or schema change is required for existing trips.
    const types = [...(Array.isArray(item.placeTypes) ? item.placeTypes : []), item.placeType].filter(value => typeof value === 'string');
    const structured = [...new Set(types.map(type => own(data.providerTypes, type)).filter(id => id && (theme === 'etc' || data.catalog[id].group === theme)))];
    const specific = structured.filter(id => !Object.values(data.fallbacks).includes(id));
    const candidates = specific;
    if (candidates.length === 1) return result(candidates[0], 'place-type', theme);
    const scoped = candidates.filter(id => data.catalog[id].group === theme);
    if (scoped.length === 1) return result(scoped[0], 'place-type', theme);
    const name = normalize(item.place).slice(0, 2000);
    const allowed = rules.filter(rule => theme === 'etc' || data.catalog[rule.id].group === theme);
    const matches = allowed.map(rule => ({ id: rule.id, score: Math.max(0, ...rule.words.filter(word => hasWord(name, word)).map(word => Array.from(word).length)) })).filter(row => row.score);
    matches.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    if (theme === 'etc' && new Set(matches.map(row => data.catalog[row.id].group)).size > 1) return result(fallback, 'ambiguous', theme);
    if (matches.length && (!matches[1] || matches[0].score > matches[1].score)) return result(matches[0].id, 'name', theme);
    // Ambiguous names, missing fields, and every unsupported language retain a
    // semantically broad illustration. Selection is stable across render/order.
    return result(structured.length === 1 ? structured[0] : fallback, matches.length ? 'ambiguous' : 'theme', theme);
  }
  return Object.freeze({ resolve, normalize, subtype, subtypes, presentation, catalog: data.catalog, version: data.version });
});
