const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let countries;
const context = { Intl, window: { TripLog: { register(_name, api) { countries = api; } } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/app/data/countries.js'), 'utf8'), context);

for (const [query, code] of [
  ['일본','JP'], ['Japan','JP'], ['jApAn','JP'], ['JP','JP'],
  ['대한민국','KR'], ['South Korea','KR'], ['USA','US'], ['U.S.A.','US'],
  ['United States','US'], ['UK','GB'], ['United Kingdom','GB'],
  ['Turkey','TR'], ['Türkiye','TR'], ['Turkiye','TR'],
  ['Czech Republic','CZ'], ['Czechia','CZ'], ['Hong Kong','HK'], ['Macau','MO'],
]) {
  assert.equal(countries.findCountryByName(query)?.code, code, `Exact country: ${query}`);
  assert.ok(countries.searchCountries(query).some(country => country.code === code), `Search: ${query}`);
}
const database = countries.getCountryDatabase();
for (const country of database) {
  assert.equal(countries.findCountryByName(country.englishName)?.code, country.code, country.englishName);
}
assert.ok(countries.searchCountries('jap').some(country => country.code === 'JP'));
assert.equal(countries.findCountryByName('jap'), null, 'A partial country must not be silently saved.');
assert.equal(countries.findCountryByName(''), null);
assert.equal(countries.findCountryByName('없는 나라'), null);
console.log(`PASS: ${database.length} English country names, Korean/English/code aliases, case/punctuation, partial and invalid inputs.`);
