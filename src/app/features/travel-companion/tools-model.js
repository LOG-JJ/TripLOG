(function (root, factory) {
  'use strict';
  const api = factory(typeof module === 'object' && module.exports ? require('./model') : root.TripLog.features.travelCompanion.model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TripLog.register('features.travelCompanion.toolsModel', api);
})(typeof window === 'undefined' ? globalThis : window, function (companion) {
  'use strict';
  // Offline city centres; selections never geocode or change the saved destination.
  const cities = [
    ['서울','KR',37.5665,126.978,'Asia/Seoul','Seoul'],['부산','KR',35.1796,129.0756,'Asia/Seoul','Busan'],
    ['순천','KR',34.9506,127.4872,'Asia/Seoul','Suncheon'],['제주','KR',33.4996,126.5312,'Asia/Seoul','Jeju'],
    ['강릉','KR',37.7519,128.8761,'Asia/Seoul','Gangneung'],['여수','KR',34.7604,127.6622,'Asia/Seoul','Yeosu'],
    ['경주','KR',35.8562,129.2247,'Asia/Seoul','Gyeongju'],['전주','KR',35.8242,127.148,'Asia/Seoul','Jeonju'],
    ['도쿄','JP',35.6762,139.6503,'Asia/Tokyo','Tokyo'],['오사카','JP',34.6937,135.5023,'Asia/Tokyo','Osaka'],
    ['교토','JP',35.0116,135.7681,'Asia/Tokyo','Kyoto'],['후쿠오카','JP',33.5902,130.4017,'Asia/Tokyo','Fukuoka'],
    ['삿포로','JP',43.0618,141.3545,'Asia/Tokyo','Sapporo'],['나고야','JP',35.1815,136.9066,'Asia/Tokyo','Nagoya'],
    ['오키나와','JP',26.2124,127.6809,'Asia/Tokyo','Okinawa|Naha'],['타이베이','TW',25.033,121.5654,'Asia/Taipei','Taipei'],
    ['홍콩','HK',22.3193,114.1694,'Asia/Hong_Kong','Hong Kong'],['마카오','MO',22.1987,113.5439,'Asia/Macau','Macau'],
    ['상하이','CN',31.2304,121.4737,'Asia/Shanghai','Shanghai'],['베이징','CN',39.9042,116.4074,'Asia/Shanghai','Beijing'],
    ['방콕','TH',13.7563,100.5018,'Asia/Bangkok','Bangkok'],['치앙마이','TH',18.7883,98.9853,'Asia/Bangkok','Chiang Mai'],
    ['푸껫','TH',7.8804,98.3923,'Asia/Bangkok','Phuket|푸켓'],['싱가포르','SG',1.3521,103.8198,'Asia/Singapore','Singapore'],
    ['다낭','VN',16.0544,108.2022,'Asia/Ho_Chi_Minh','Da Nang'],['하노이','VN',21.0278,105.8342,'Asia/Ho_Chi_Minh','Hanoi'],
    ['호찌민','VN',10.8231,106.6297,'Asia/Ho_Chi_Minh','Ho Chi Minh|호치민'],['나트랑','VN',12.2388,109.1967,'Asia/Ho_Chi_Minh','Nha Trang'],
    ['세부','PH',10.3157,123.8854,'Asia/Manila','Cebu'],['마닐라','PH',14.5995,120.9842,'Asia/Manila','Manila'],
    ['발리','ID',-8.65,115.2167,'Asia/Makassar','Bali'],['쿠알라룸푸르','MY',3.139,101.6869,'Asia/Kuala_Lumpur','Kuala Lumpur'],
    ['괌','GU',13.4443,144.7937,'Pacific/Guam','Guam'],['호놀룰루','US',21.3099,-157.8581,'Pacific/Honolulu','Honolulu|하와이|오아후'],
    ['뉴욕','US',40.7128,-74.006,'America/New_York','New York'],['로스앤젤레스','US',34.0522,-118.2437,'America/Los_Angeles','Los Angeles|LA'],
    ['샌프란시스코','US',37.7749,-122.4194,'America/Los_Angeles','San Francisco'],['라스베이거스','US',36.1699,-115.1398,'America/Los_Angeles','Las Vegas'],
    ['밴쿠버','CA',49.2827,-123.1207,'America/Vancouver','Vancouver'],['토론토','CA',43.6532,-79.3832,'America/Toronto','Toronto'],
    ['런던','GB',51.5074,-0.1278,'Europe/London','London'],['파리','FR',48.8566,2.3522,'Europe/Paris','Paris'],
    ['로마','IT',41.9028,12.4964,'Europe/Rome','Rome'],['밀라노','IT',45.4642,9.19,'Europe/Rome','Milan'],
    ['바르셀로나','ES',41.3874,2.1686,'Europe/Madrid','Barcelona'],['마드리드','ES',40.4168,-3.7038,'Europe/Madrid','Madrid'],
    ['리스본','PT',38.7223,-9.1393,'Europe/Lisbon','Lisbon'],['프라하','CZ',50.0755,14.4378,'Europe/Prague','Prague'],
    ['빈','AT',48.2082,16.3738,'Europe/Vienna','Vienna|비엔나'],['취리히','CH',47.3769,8.5417,'Europe/Zurich','Zurich'],
    ['암스테르담','NL',52.3676,4.9041,'Europe/Amsterdam','Amsterdam'],['베를린','DE',52.52,13.405,'Europe/Berlin','Berlin'],
    ['이스탄불','TR',41.0082,28.9784,'Europe/Istanbul','Istanbul'],['두바이','AE',25.2048,55.2708,'Asia/Dubai','Dubai'],
    ['시드니','AU',-33.8688,151.2093,'Australia/Sydney','Sydney'],['멜버른','AU',-37.8136,144.9631,'Australia/Melbourne','Melbourne'],
    ['오클랜드','NZ',-36.8485,174.7633,'Pacific/Auckland','Auckland'],['트롬쇠','NO',69.6492,18.9553,'Europe/Oslo','Tromso'],
    ['레이캬비크','IS',64.1466,-21.9426,'Atlantic/Reykjavik','Reykjavik']
  ].map(([name,country,lat,lon,zone,aliases],index) => ({ id:String(index),name,country,lat,lon,zone,aliases:aliases.split('|') }));
  const norm = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s._-]/g,'');
  function destination(trip) {
    const name = norm(trip.city);
    return cities.find(city => (!trip.countryCode || city.country === trip.countryCode) && [city.name,...city.aliases].some(value => norm(value) === name)) || null;
  }
  function cityList(trip) {
    if (destination(trip)) return cities;
    const location = (trip.itineraryItems || []).find(item => typeof item.lat === 'number' && typeof item.lon === 'number' && Number.isFinite(item.lat) && Number.isFinite(item.lon) && Math.abs(item.lat) <= 90 && Math.abs(item.lon) <= 180);
    const zone = companion.defaultZone(trip);
    return location && trip.city && zone ? [{ id:'destination',name:trip.city,country:trip.countryCode,lat:location.lat,lon:location.lon,zone,aliases:[] },...cities] : cities;
  }
  function parts(instant, zone) {
    const fields = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{ timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(instant).map(row => [row.type,row.value]));
    return { date:`${fields.year}-${fields.month}-${fields.day}`,time:`${fields.hour}:${fields.minute}` };
  }
  function instant(date,time,zone) {
    const value = companion.utcTime(date,time,zone);
    return new Date(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:00Z`);
  }
  function convertTime(date,time,from,to) {
    const stamp=instant(date,time,from), result=parts(stamp,to);
    const dayDiff=Math.round((Date.parse(result.date)-Date.parse(date))/86400000);
    const delta=(Date.parse(`${result.date}T${result.time}Z`)-Date.parse(`${date}T${time}Z`))/3600000;
    return { ...result,dayDiff,delta };
  }
  function solar(city,date,sunCalc,now=new Date()) {
    if (!city || !companion.validDate(date)) throw new Error('도시와 날짜를 선택해 주세요.');
    const noon=instant(date,'12:00',city.zone), times=sunCalc.getTimes(noon,city.lat,city.lon);
    const valid=value => value instanceof Date && Number.isFinite(value.getTime());
    if (!valid(times.sunrise) || !valid(times.sunset)) return { polar:sunCalc.getPosition(noon,city.lat,city.lon).altitude > 0 ? '백야' : '극야' };
    return { sunrise:parts(times.sunrise,city.zone).time,sunset:parts(times.sunset,city.zone).time,
      minutes:Math.round((times.sunset-times.sunrise)/60000),today:parts(now,city.zone).date===date,
      untilSunset:Math.ceil((times.sunset-now)/60000),progress:Math.max(0,Math.min(1,(now-times.sunrise)/(times.sunset-times.sunrise))) };
  }
  const units = { temperature:[['°C','섭씨'],['°F','화씨']],distance:[['km','킬로미터'],['mi','마일']],weight:[['kg','킬로그램'],['lb','파운드']] };
  function defaults(country,category) { return country==='US' || country==='GB' && category==='distance' ? units[category][1][0] : units[category][0][0]; }
  function convertUnit(raw,category,from) {
    if (String(raw).trim()==='' || !/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(raw).trim())) return null;
    const value=Number(raw); if (!Number.isFinite(value) || Math.abs(value)>1e12 || !units[category]) return null;
    const reverse=from===units[category][1][0];
    if (category!=='temperature' && value<0) return null;
    if (category==='temperature') return reverse ? (value-32)*5/9 : value*9/5+32;
    return category==='distance' ? reverse ? value*1.609344 : value/1.609344 : reverse ? value*0.45359237 : value/0.45359237;
  }
  function wifiPayload(ssid,password,security) {
    const bytes=value=>new TextEncoder().encode(value).length;
    if (!ssid.trim() || bytes(ssid)>32) throw new Error('네트워크 이름은 1~32바이트로 입력해 주세요.');
    if (!['WPA','WEP','nopass'].includes(security)) throw new Error('보안 방식을 확인해 주세요.');
    if (security==='WPA' && !((bytes(password)>=8 && bytes(password)<=63) || /^[0-9a-f]{64}$/i.test(password))) throw new Error('WPA 비밀번호는 8~63바이트 또는 64자리 16진수로 입력해 주세요.');
    if (security==='WEP' && !([5,13].includes(bytes(password)) || /^(?:[0-9a-f]{10}|[0-9a-f]{26})$/i.test(password))) throw new Error('WEP 비밀번호 형식을 확인해 주세요.');
    const escape=value=>value.replace(/[\\;,:\"]/g,'\\$&');
    return `WIFI:T:${security};S:${escape(ssid)};${security==='nopass' ? '' : `P:${escape(password)};`};`;
  }
  return { cities,destination,cityList,parts,instant,convertTime,solar,units,defaults,convertUnit,wifiPayload };
});
