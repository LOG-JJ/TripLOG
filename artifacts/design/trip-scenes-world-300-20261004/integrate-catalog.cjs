// Apply the approved complete target catalog while artwork production continues.
// Final asset checks must pass before this batch can be released.
const fs = require('node:fs');
const path = require('node:path');
const docs = __dirname, root = path.resolve(docs, '../../..');
const batch = JSON.parse(fs.readFileSync(path.join(docs, 'batch.json'), 'utf8'));
const dataPath = path.join(root, 'src/app/data/destination-scenes.js');
const resolverPath = path.join(root, 'src/app/shared/destination-scenes.js');
const original = require(dataPath);
const quote = value => "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const lines = values => {
  const result = [];
  for (let i = 0; i < values.length; i += 4) result.push('    ' + values.slice(i, i + 4).map(quote).join(', ') + ',');
  return result.join('\n');
};
if (!fs.existsSync(path.join(docs, 'base-catalog.json'))) {
  if (original.catalog.length !== 113) throw Error('Unexpected baseline');
  fs.writeFileSync(path.join(docs, 'base-catalog.json'), JSON.stringify(original.catalog, null, 2) + '\n');
}
let source = fs.readFileSync(dataPath, 'utf8');
if (!source.includes('const expandedArtwork = new Set(')) {
  if (batch.cities.length !== 242 || !batch.planningComplete) throw Error('Incomplete plan');
  const marker = '  const primary = new Set([';
  source = source.replace(marker, '  // Independent artwork for every overseas destination in the 300-place catalog.\n' +
    '  const expandedArtwork = new Set([\n' + lines(batch.cities.map(city => city.id)) + '\n  ]);\n' + marker);
  source = source.replace('  ]);\n  // id, display name, accepted country/territory codes, kind, scene, exact aliases.',
    '    ...expandedArtwork,\n  ]);\n  // id, display name, accepted country/territory codes, kind, scene, exact aliases.');
  const rows = batch.cities.filter(city => city.isNew).map(city => '    [' + [
    city.id, city.name, city.countryCodes.join(','), city.kind, city.theme, city.aliases,
  ].map(quote).join(', ') + '],').join('\n');
  source = source.replace('  ];\n  // Keep revised paintings immutable', rows + '\n  ];\n  // Keep revised paintings immutable');
  source = source.replaceAll('revisedArtwork.has(id) ? 3 : 2', 'expandedArtwork.has(id) ? 4 : revisedArtwork.has(id) ? 3 : 2');
  source = source.replace('themes, version: 4', 'themes, version: 5');
  fs.writeFileSync(dataPath, source);
}
delete require.cache[require.resolve(dataPath)];
const target = require(dataPath);
if (target.catalog.length !== 330 || target.catalog.filter(city => city.dedicated).length !== 315) throw Error('Wrong target counts');
const codes = [...new Set(target.catalog.flatMap(city => city.countryCodes))].sort();
const ko = new Intl.DisplayNames(['ko'], { type: 'region' });
const en = new Intl.DisplayNames(['en'], { type: 'region' });
const extra = {
  BA: ['Bosnia and Herzegovina', '보스니아헤르체고비나'], GE: ['그루지야'],
  IL: ['이스라엘'], MM: ['Myanmar', 'Burma', '버마'],
  PS: ['팔레스타인', 'Palestine', 'State of Palestine'], ZA: ['남아프리카공화국', '남아공'],
  PF: ['프렌치 폴리네시아'], LA: ["Lao People's Democratic Republic"],
};
let resolver = fs.readFileSync(resolverPath, 'utf8');
const match = resolver.match(/  const countryNames = \{([\s\S]*?)\n  \};/);
if (!match) throw Error('Country alias block not found');
const previous = {};
for (const item of match[1].matchAll(/([A-Z]{2}): \[([^\]]*)\]/g)) {
  previous[item[1]] = [...item[2].matchAll(/'((?:\\.|[^'])*)'/g)].map(part => part[1].replace(/\\(['\\])/g, '$1'));
}
const names = Object.fromEntries(codes.map(code => [code, [...new Set([...(previous[code] || []), ko.of(code), en.of(code), ...(extra[code] || [])])]]));
const block = '  const countryNames = {\n' + Object.entries(names).map(([code, aliases]) =>
  '    ' + code + ': [' + aliases.map(quote).join(', ') + '],').join('\n') + '\n  };';
resolver = resolver.replace(match[0], block);
fs.writeFileSync(resolverPath, resolver);
fs.writeFileSync(path.join(docs, 'country-aliases.json'), JSON.stringify(names, null, 2) + '\n');
console.log(JSON.stringify({ destinations: target.catalog.length, overseas: target.catalog.filter(city => city.countryCodes[0] !== 'KR').length,
  dedicated: target.catalog.filter(city => city.dedicated).length, countriesAndTerritories: codes.length, artworkJobs: batch.expected }));
