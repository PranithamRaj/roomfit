// Server-rendered AR / 3D viewer built on Google's <model-viewer>.
//  - Android: launches Scene Viewer (or WebXR) for true-to-scale placement.
//  - iOS: launches AR Quick Look; model-viewer converts the GLB to USDZ on the fly
//    when the product has no dedicated USDZ file.
// `?embed=1` renders a chrome-less 3D preview for the app's in-page WebView.
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const absolute = (req, url) => (!url || /^https?:\/\//i.test(url) ? url : `${req.protocol}://${req.get('host')}${url}`);

function renderArPage(req, product) {
  const embed = req.query.embed === '1';
  const dims = product.dimensions || {};
  const src = absolute(req, product.modelUrl);
  const iosSrc = absolute(req, product.iosModelUrl);
  const poster = absolute(req, product.images?.[0]);
  // Lighting goes on the ceiling; everything else sits on the floor.
  const placement = product.placement === 'wall' ? 'wall' : 'floor';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(product.name)} · View in your room</title>
<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js"></script>
<style>
  :root { --ink:#1f1a17; --muted:#6f655d; --accent:#b4552d; --bg:#f6f1eb; --card:#fffaf5; }
  * { box-sizing: border-box; }
  html, body { margin:0; height:100%; background:var(--bg); color:var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { display:flex; flex-direction:column; }
  header { padding:14px 16px 6px; }
  header h1 { margin:0; font-size:18px; }
  header p { margin:2px 0 0; color:var(--muted); font-size:13px; }
  model-viewer { flex:1; width:100%; min-height:260px; background:radial-gradient(circle at 50% 40%, #fff 0%, var(--bg) 70%);
    --poster-color: transparent; }
  .ar-btn { position:absolute; left:50%; bottom:20px; transform:translateX(-50%); border:0; border-radius:999px;
    background:var(--accent); color:#fff; font-size:16px; font-weight:600; padding:14px 22px;
    box-shadow:0 6px 18px rgba(180,85,45,.35); white-space:nowrap; }
  .chips { position:absolute; top:10px; left:10px; right:10px; display:flex; gap:6px; flex-wrap:wrap; pointer-events:none; }
  .chip { background:rgba(255,250,245,.92); border-radius:999px; padding:5px 10px; font-size:12px; color:var(--ink);
    box-shadow:0 1px 4px rgba(0,0,0,.08); }
  .chip.warn { background:#fff1d6; color:#7a4b00; }
  .toggle { position:absolute; top:10px; right:10px; pointer-events:auto; border:0; border-radius:999px;
    background:var(--ink); color:#fff; font-size:12px; padding:6px 12px; }
  .dim { display:none; background:var(--ink); color:#fff; border-radius:6px; padding:2px 6px; font-size:11px;
    font-weight:600; border:0; pointer-events:none; }
  model-viewer.show-dims .dim { display:block; }
  /* Edge labels would overflow the frame; pull them in over the model. */
  .dim[slot="hotspot-h"] { transform:translateX(60%); }
  .dim[slot="hotspot-d"] { transform:translateX(-60%); }
  .note { padding:10px 16px 18px; color:var(--muted); font-size:13px; line-height:1.4; }
  .note b { color:var(--ink); }
  #no-ar { display:none; }
</style>
</head>
<body>
${embed ? '' : `<header><h1>${esc(product.name)}</h1><p>Listed size: ${dims.width} W × ${dims.depth} D × ${dims.height} H cm</p></header>`}
<model-viewer id="mv"
  src="${esc(src)}" ${iosSrc ? `ios-src="${esc(iosSrc)}"` : ''} ${poster ? `poster="${esc(poster)}"` : ''}
  alt="3D model of ${esc(product.name)}"
  camera-controls touch-action="pan-y" shadow-intensity="1" exposure="1" environment-image="neutral"
  ${embed ? 'auto-rotate' : ''}
  ${embed ? '' : 'ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed"'} ar-placement="${placement}"
  style="position:relative">
  ${embed ? '' : '<button slot="ar-button" class="ar-btn">📐 Place in my room (true size)</button>'}
  <button slot="hotspot-w" class="dim" data-position="0 0 0" data-normal="0 1 0"></button>
  <button slot="hotspot-h" class="dim" data-position="0 0 0" data-normal="1 0 0"></button>
  <button slot="hotspot-d" class="dim" data-position="0 0 0" data-normal="1 0 0"></button>
  <div class="chips"><span class="chip" id="size-chip">Loading model…</span><span class="chip warn" id="warn-chip" hidden></span>
    <button class="toggle" id="dims-toggle" type="button">Show dimensions</button></div>
</model-viewer>
${embed ? '' : `<div class="note">
  <b>How it works:</b> tap the button, point your camera at the floor, and the ${esc(product.name)} appears at its
  real size so you can check it fits and suits your room. Walk around it, and pinch to rotate.
  <span id="no-ar"><br><br><b>AR is not available on this device.</b> Open this page on an ARCore-capable Android phone
  (Chrome) or an iPhone/iPad (Safari) to place it in your room. You can still rotate the 3D model here.</span>
</div>`}
<script type="module">
  const mv = document.getElementById('mv');
  const listed = ${JSON.stringify({ width: dims.width, depth: dims.depth, height: dims.height })};
  const sizeChip = document.getElementById('size-chip');
  const warnChip = document.getElementById('warn-chip');
  const noAr = document.getElementById('no-ar');

  document.getElementById('dims-toggle').addEventListener('click', (e) => {
    const on = mv.classList.toggle('show-dims');
    e.target.textContent = on ? 'Hide dimensions' : 'Show dimensions';
  });

  mv.addEventListener('load', async () => {
    await customElements.whenDefined('model-viewer');
    const size = mv.getDimensions();          // metres, as the model will appear in AR
    const c = mv.getBoundingBoxCenter();
    const cm = (m) => Math.round(m * 100);
    const model = { width: cm(size.x), height: cm(size.y), depth: cm(size.z) };
    sizeChip.textContent = 'AR size ' + model.width + ' × ' + model.depth + ' × ' + model.height + ' cm';

    // Flag listings whose 3D model isn't authored at real-world scale.
    const off = ['width', 'depth', 'height'].some((k) => listed[k] && Math.abs(model[k] - listed[k]) / listed[k] > 0.1);
    if (off) {
      warnChip.hidden = false;
      warnChip.textContent = '⚠ 3D model differs from listed size — trust the listed dimensions';
    }
    window.__modelSize = model;
    const msg = JSON.stringify({ type: 'model-size', model, off });
    window.ReactNativeWebView?.postMessage(msg);            // native app WebView
    if (window.parent !== window) window.parent.postMessage(msg, '*'); // web app iframe

    const x0 = c.x - size.x / 2, x1 = c.x + size.x / 2, y0 = c.y - size.y / 2, y1 = c.y + size.y / 2, z1 = c.z + size.z / 2;
    const place = (name, pos, text) => {
      mv.updateHotspot({ name, position: pos.join(' ') });
      mv.querySelector('[slot="' + name + '"]').textContent = text;
    };
    place('hotspot-w', [c.x, y1, z1], (listed.width || model.width) + ' cm W');
    place('hotspot-h', [x0, c.y, z1], (listed.height || model.height) + ' cm H');
    place('hotspot-d', [x1, y0, c.z], (listed.depth || model.depth) + ' cm D');
  });

  if (noAr) {
    setTimeout(() => { if (!mv.canActivateAR) noAr.style.display = 'inline'; }, 1500);
  }
  mv.addEventListener('error', () => { sizeChip.textContent = 'Could not load the 3D model'; });
</script>
</body>
</html>`;
}

module.exports = { renderArPage };
