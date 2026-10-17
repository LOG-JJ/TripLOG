(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TripLog?.register('data.serviceConfig', api);
})(typeof window === 'undefined' ? globalThis : window, function () {
  return Object.freeze({
    url: 'https://iehdziiplzgvxcrbizgv.supabase.co',
    publishableKey: 'sb_publishable_b5CwF1zyb5bzNHUT50xNsg_pSon5Glc',
    appUrl: 'https://triplog-5qs.pages.dev/Travel',
  });
});
