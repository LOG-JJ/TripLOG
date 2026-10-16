// Rebuild the inspectable coverage record directly from the runtime catalog.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const data = require(path.join(root, 'src/app/data/destination-scenes'));
const countries = require('./country-aliases.json');
const baseline = new Map(require('./base-catalog.json').map(city => [city.id, city]));
const batch = require('./batch.json');
const planned = new Map(batch.cities.map(city => [city.id, city]));
const overseas = data.catalog.filter(city => !city.countryCodes.includes('KR'));
const records = overseas.map(city => ({
  id: city.id, name: city.name, kind: city.kind,
  countryCodes: city.countryCodes,
  countries: city.countryCodes.map(code => countries[code]?.[0] || code),
  aliases: city.aliases,
  change: !baseline.has(city.id) ? 'new-destination' : baseline.get(city.id).dedicated ? 'retained-artwork' : 'new-dedicated-artwork',
  src: city.src, mobileSrc: city.mobileSrc,
  webReady: fs.existsSync(path.join(root, city.src)) && fs.existsSync(path.join(root, city.mobileSrc)),
  originalPairReady: planned.has(city.id) ? ['landscape', 'mobile'].every(variant => fs.existsSync(path.join(__dirname, 'assets-original', city.id + '-' + variant + '.png'))) : true,
})).sort((a, b) => a.countries[0].localeCompare(b.countries[0], 'ko') || a.name.localeCompare(b.name, 'ko'));
const coverage = {
  scope: '300 overseas destinations; editorial coverage, not a visitor ranking',
  overseas: records.length,
  domestic: data.catalog.length - records.length,
  overseasWithPreparedArtwork: records.filter(city => city.webReady).length,
  newOriginalsSaved: fs.readdirSync(path.join(__dirname, 'assets-original')).filter(name => name.endsWith('.png')).length,
  newOriginalsExpected: batch.expected,
  records,
};
fs.writeFileSync(path.join(__dirname, 'coverage.json'), JSON.stringify(coverage, null, 2) + '\n');
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const kind = { city: '도시', town: '소도시', island: '섬', region: '지역' };
const changes = { 'new-destination': '새 목적지', 'retained-artwork': '기존 그림 유지', 'new-dedicated-artwork': '전용 그림 추가' };
const lines = [
  '# 해외 300곳 목록', '',
  '런타임 목적지 목록에서 직접 생성한 기록입니다. 국가와 목적지 이름을 함께 사용하며, 도시·소도시·섬·지역을 구분합니다. 통계상 방문객 순위를 뜻하지 않습니다.', '',
  `해외 ${coverage.overseas}곳 / 국내 ${coverage.domestic}곳 유지 / 해외 웹용 그림 준비 ${coverage.overseasWithPreparedArtwork}쌍 / 이번 원본 저장 ${coverage.newOriginalsSaved}/${coverage.newOriginalsExpected}장.`, '',
  '생성·저장 상태를 표시한 목록이며 운영 배포 완료를 뜻하지 않습니다. 배포 검증은 별도 기록으로 확인합니다.', '',
  '| 국가·지역 | 목적지 | 분류 | 변경 | PC·모바일 그림 |',
  '| --- | --- | --- | --- | --- |',
  ...records.map(city => `| ${escape(city.countries.join(' / '))} | ${escape(city.name)} | ${kind[city.kind] || escape(city.kind)} | ${changes[city.change]} | ${city.webReady ? `[PC](../../../${city.src}) · [모바일](../../../${city.mobileSrc})` : '제작 중'} |`),
  '',
  '한글·영문·현지 별칭과 실제 자산 경로는 [coverage.json](coverage.json)에 함께 기록했습니다. 국가·목적지 이름이 불명확하거나 여러 목적지이면 기존 공통 그림을 사용하며 저장된 여행 정보를 변경하지 않습니다.',
  '',
];
fs.writeFileSync(path.join(__dirname, 'catalog-index.md'), lines.join('\n'));
console.log(JSON.stringify({ overseas: coverage.overseas, overseasWithPreparedArtwork: coverage.overseasWithPreparedArtwork, newOriginalsSaved: coverage.newOriginalsSaved, expected: coverage.newOriginalsExpected }));
