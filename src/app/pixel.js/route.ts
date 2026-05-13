import { NextResponse } from "next/server";

export const dynamic = "force-static";

const SCRIPT = `(function(){
  var script = document.currentScript;
  var token = script && script.getAttribute('data-token');
  var endpoint = script && script.getAttribute('data-endpoint') || (script && script.src.replace(/\\/pixel\\.js.*/, ''));
  if (!endpoint) return;

  // 1) Capture sl + slp from URL on every page load and stash in localStorage
  try {
    var qs = new URLSearchParams(location.search);
    var sl = qs.get('sl');
    var slp = qs.get('slp');
    if (sl) {
      localStorage.setItem('sociallink_sl', sl);
      localStorage.setItem('sociallink_sl_ts', String(Date.now()));
      if (slp) localStorage.setItem('sociallink_slp', slp);
    }
  } catch (e) {}

  // 2) If data-amount-cents present, fire a conversion now
  function track(args) {
    args = args || {};
    var amount = args.amountCents != null ? args.amountCents :
      parseInt(script && script.getAttribute('data-amount-cents') || '0', 10);
    if (!amount || !token) return;
    var code, platform;
    try {
      code = args.code || localStorage.getItem('sociallink_sl');
      platform = args.platform || localStorage.getItem('sociallink_slp');
      var ts = parseInt(localStorage.getItem('sociallink_sl_ts') || '0', 10);
      if (ts && Date.now() - ts > 30 * 24 * 3600 * 1000) {
        // 30-day attribution window
        localStorage.removeItem('sociallink_sl');
        return;
      }
    } catch (e) {}
    if (!code) return;
    var body = JSON.stringify({
      code: code,
      pixelToken: token,
      amountCents: amount,
      orderId: args.orderId || (script && script.getAttribute('data-order-id')) || null,
      platform: platform || null,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint + '/api/track/pixel', new Blob([body], { type: 'application/json' }));
    } else {
      fetch(endpoint + '/api/track/pixel', { method: 'POST', body: body, headers: { 'content-type': 'application/json' }, keepalive: true, credentials: 'omit', mode: 'no-cors' }).catch(function(){});
    }
  }
  // Auto-fire if data-amount-cents was set on the script tag
  track();
  // Expose for manual calls
  window.sociallink = { track: track };
})();
`;

export async function GET() {
  return new NextResponse(SCRIPT, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
      "access-control-allow-origin": "*",
    },
  });
}
