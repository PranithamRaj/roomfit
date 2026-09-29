// "Will it fit?" — compares a product's footprint with a measured space.
// All values in centimetres. `clearance` is breathing room on each side and in front,
// so needed width = w + 2c and needed depth = d + c (the back sits against a wall).
// Height is optional; without it only the floor footprint is checked.

function evaluate(w, d, h, space, clearance) {
  const rows = [
    { key: 'width', label: 'Width', need: w + 2 * clearance, have: space.width },
    { key: 'depth', label: 'Depth', need: d + clearance, have: space.depth },
  ];
  if (space.height) rows.push({ key: 'height', label: 'Height', need: h, have: space.height });
  return rows.map((r) => ({ ...r, ok: r.need <= r.have, margin: Math.round((r.have - r.need) * 10) / 10 }));
}

export function checkFit(dimensions, space, clearance = 0) {
  const { width: w, depth: d, height: h } = dimensions;
  const straight = evaluate(w, d, h, space, clearance);
  if (straight.every((r) => r.ok)) return { fits: true, rotated: false, rows: straight };

  // Turning it 90° swaps width and depth — often enough for chairs and ottomans.
  const turned = evaluate(d, w, h, space, clearance);
  if (turned.every((r) => r.ok)) return { fits: true, rotated: true, rows: turned };

  return { fits: false, rotated: false, rows: straight };
}

export function parseSpace({ width, depth, height }) {
  const n = (v) => {
    const x = Number(String(v).replace(',', '.'));
    return Number.isFinite(x) && x > 0 ? x : null;
  };
  const space = { width: n(width), depth: n(depth), height: n(height) };
  return space.width && space.depth ? space : null;
}
