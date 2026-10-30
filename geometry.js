/**
 * GEOMETRY.JS — Utilidades geométricas y de secciones de barras
 * CORREGIDO (v2): presiones de contacto en kg/cm² (antes Ton/m² sin convertir),
 * módulos de sección coherentes con q = P/(BL)(1 ± 6ex/L ± 6ey/B),
 * y verificación de núcleo central (ex ≤ L/6, ey ≤ B/6).
 */
const Geometry = (() => {

  const BAR_AREAS = {
    '0.95': 0.71, '1.27': 1.27, '1.59': 1.98, '1.91': 2.84,
    '2.22': 3.87, '2.54': 5.10, '2.87': 6.45, '3.23': 8.19
  };
  const BAR_NAMES = {
    '0.95': '#3 (3/8")', '1.27': '#4 (1/2")', '1.59': '#5 (5/8")', '1.91': '#6 (3/4")',
    '2.22': '#7 (7/8")', '2.54': '#8 (1")', '2.87': '#9 (1-1/8")', '3.23': '#10 (1-1/4")'
  };
  const BAR_WEIGHT = {
    '0.95': 0.560, '1.27': 0.994, '1.59': 1.552, '1.91': 2.235,
    '2.22': 3.043, '2.54': 3.973, '2.87': 5.060, '3.23': 6.404
  };

  function beta1(fc) {
    if (!fc || fc <= 0) return 0.85;
    if (fc <= 280) return 0.85;
    if (fc >= 550) return 0.65;
    const r = 0.85 - 0.05 * (fc - 280) / 70;
    return isFinite(r) ? r : 0.85;
  }

  function rhoBalance(fc, fy) {
    if (!fc || fc <= 0 || !fy || fy <= 0) return 0.021;
    const r = (0.85 * beta1(fc) * fc / fy) * (6000 / (6000 + fy));
    return isFinite(r) && r > 0 ? r : 0.021;
  }

  function rhoMax(fc, fy) {
    const r = 0.75 * rhoBalance(fc, fy);
    return isFinite(r) && r > 0 ? r : 0.025;
  }

  // Cuantía mínima general (vigas); para ZAPATAS se usa 0.0018 (ver design.js)
  function rhoMin(fc, fy) {
    if (!fc || fc <= 0 || !fy || fy <= 0) return 0.0018;
    const r = Math.max(14 / fy, Math.sqrt(fc) / (4 * fy));
    return isFinite(r) && r > 0 ? r : 0.0018;
  }

  function barArea(d) {
    if (!d || d <= 0) return 0;
    return BAR_AREAS[d.toString()] || (Math.PI * d * d / 4);
  }

  function barName(d) {
    if (d === undefined || d === null || isNaN(d) || d <= 0) return 'N/A';
    return BAR_NAMES[d.toString()] || `Ø${d.toFixed(2)}cm`;
  }

  function barWeight(d) {
    if (!d || d <= 0) return 0;
    return BAR_WEIGHT[d.toString()] || (d * d * 0.00617);
  }

  /**
   * PRESIONES DE CONTACTO — NSR-10 C.15 / E.15 (distribución lineal)
   *   q = P/(B·L) · (1 ± 6·ex/L ± 6·ey/B),  ex = My/P (sobre L), ey = Mx/P (sobre B)
   * Equivalente: q = P/A ± Mx/Sx ± My/Sy con:
   *   Sx = L·B²/6  (flexión sobre eje X → variación a lo largo de B)
   *   Sy = B·L²/6  (flexión sobre eje Y → variación a lo largo de L)
   * UNIDADES: devuelve kg/cm² (qmax, qmin) y Ton/m² (qmax_t, qmin_t)
   */
  function contactPressures(P, Mx, My, B, L) {
    if (!B || B <= 0 || !L || L <= 0) {
      return { qmax: 0, qmin: 0, qmax_t: 0, qmin_t: 0, A: 0, Sx: 0, Sy: 0,
               kern: { ex: 0, ey: 0, exLim: 0, eyLim: 0, ok: false } };
    }
    const A = B * L;
    const Sx = L * B * B / 6;   // asociado a Mx
    const Sy = B * L * L / 6;   // asociado a My
    const qmax_t = P / A + Math.abs(Mx || 0) / Sx + Math.abs(My || 0) / Sy;  // Ton/m²
    const qmin_t = P / A - Math.abs(Mx || 0) / Sx - Math.abs(My || 0) / Sy;  // Ton/m²
    const qmax = qmax_t / 10;   // kg/cm²  ← CORREGIDO
    const qmin = qmin_t / 10;   // kg/cm²
    // Núcleo central: validez de la distribución lineal
    const ex = Math.abs(My || 0) / Math.abs(P || 1);
    const ey = Math.abs(Mx || 0) / Math.abs(P || 1);
    const kern = { ex, ey, exLim: L / 6, eyLim: B / 6, ok: (ex <= L / 6) && (ey <= B / 6) };
    return { qmax, qmin, qmax_t, qmin_t, A, Sx, Sy, kern };
  }

  function eccentricities(P, Mx, My) {
    const ex = Math.abs(P) > 0 ? Math.abs(My || 0) / Math.abs(P) : 0;
    const ey = Math.abs(P) > 0 ? Math.abs(Mx || 0) / Math.abs(P) : 0;
    return { ex: isFinite(ex) ? ex : 0, ey: isFinite(ey) ? ey : 0 };
  }

  return {
    BAR_AREAS, BAR_NAMES, BAR_WEIGHT,
    beta1, rhoBalance, rhoMax, rhoMin,
    barArea, barName, barWeight,
    contactPressures, eccentricities
  };
})();