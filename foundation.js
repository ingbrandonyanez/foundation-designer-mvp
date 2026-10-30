/**
 * FOUNDATION.JS — Orquestador del diseño
 * Incluye: núcleo central, ELU suelo (qmax_u ≤ qult), asentamiento con unidades
 * corregidas, ld E.12.2/E.12.3, bEff por dirección, sin estribos (d = h − rec − Ø/2)
 */
const Foundation = (() => {

  let current = null;

  function analyze(input) {
    const {
      B, L, h, rec, colA, colB, pedH, sol, fc, fy, gc,
      qa, gs, NF, k, delta, Df, cp, phi,
      P, Mx, My, Hx, Hy, Pu, Mux, Muy, Hux, Huy,
      dbX, dbY, sX, sY, hasTop, dbTopX, dbTopY, sTopX, sTopY,
      hookX, hookTypeX, hookY, hookTypeY, hookTopX, hookTypeTopX, hookTopY, hookTypeTopY,
      dbCol, nCol
    } = input;

    const dB = B || 1.8, dL = L || 1.8, dh = h || 0.45, dRec = rec || 7.5, dPedH = pedH || 60;
    const dFc = fc || 210, dFy = fy || 4200;
    const dDbX = dbX || 1.27, dDbY = dbY || 1.27, dSX = sX || 20, dSY = sY || 20;
    const dDbCol = dbCol || 1.91, dNCol = nCol || 8;

    // Peralte efectivo SIN estribo (criterio del curso / Excel): d = h − rec − Ø/2
    const d = dh * 100 - dRec - Math.max(dDbX, dDbY) / 2;

    // --- Servicio: excentricidades y presiones (kg/cm²) ---
    const ecc = Geometry.eccentricities(P, Mx, My);
    const press = Geometry.contactPressures(P, Mx, My, dB, dL);
    const kern = press.kern;

    // --- Geotecnia ---
    const geoCheck = Geotechnical.checkPressures(press.qmax, press.qmin, qa);
    const bc = Geotechnical.bearingCapacity(cp || 0, (gs || 1800) / 1000, Df || 1.5, dB, dL, phi || 28);
    const sliding = Geotechnical.slidingCheck(P || 0, Math.sqrt((Hx || 0) ** 2 + (Hy || 0) ** 2), phi || 28);
    const overturn = Geotechnical.overturningCheck(P || 0, dB, dL, Mx || 0, My || 0);

    // Asentamiento elástico: qnet en kg/cm² (CORREGIDO unidades)
    const qnet_t = press.qmax_t - ((gs || 1800) / 1000) * (Df || 1.5) - ((gc || 2400) / 1000) * dh; // Ton/m²
    const settle = Geotechnical.settlement(Math.max(0, qnet_t / 10), dB * 100, k || 2);

    // --- ELU del suelo: demanda factorizada vs capacidad última ---
    const pressU = Geometry.contactPressures(Pu || 0, Mux || 0, Muy || 0, dB, dL);
    const bearingULS = { demand: pressU.qmax, capacity: bc.qult, ok: pressU.qmax <= bc.qult };

    // --- Estructurales ---
    const punch = Design.punching(Pu || 58, colA || 30, colB || 30, d, dFc, dB, dL);
    const shearX = Design.oneWayShear(Pu || 58, colA || 30, colB || 30, d, dFc, dB, dL, 'x');
    const shearY = Design.oneWayShear(Pu || 58, colA || 30, colB || 30, d, dFc, dB, dL, 'y');
    const flexX = Design.flexion(Pu || 58, colA || 30, colB || 30, d, dFc, dFy, dB, dL, 'x');
    const flexY = Design.flexion(Pu || 58, colA || 30, colB || 30, d, dFc, dFy, dB, dL, 'y');

    const AsReqX = (isNaN(flexX.AsReq) || flexX.AsReq <= 0) ? flexX.AsMin : flexX.AsReq;
    const AsReqY = (isNaN(flexY.AsReq) || flexY.AsReq <= 0) ? flexY.AsMin : flexY.AsReq;

    // Anchos efectivos: barras ∥ B se reparten en L; barras ∥ L se reparten en B
    const bEffX = dL * 100;
    const bEffY = dB * 100;
    const rebarX = Reinforcement.checkReinforcement(AsReqX, flexX.AsMin, dDbX, dSX, bEffX);
    const rebarY = Reinforcement.checkReinforcement(AsReqY, flexY.AsMin, dDbY, dSY, bEffY);

    const layout = Reinforcement.layout(dB, dL, colA || 30, colB || 30, dDbX, dDbY, dSX, dSY, dRec);
    const hooks = {
      hookX: hookX || false, hookTypeX: hookTypeX || 90,
      hookY: hookY || false, hookTypeY: hookTypeY || 90,
      hookTopX: hookTopX || false, hookTypeTopX: hookTypeTopX || 90,
      hookTopY: hookTopY || false, hookTypeTopY: hookTypeTopY || 90
    };
    const steel = Reinforcement.steelTable(layout, dDbX, dDbY, dh, hasTop || false,
      dbTopX || 1.27, dbTopY || 1.27, sTopX || 25, sTopY || 25, dB, dL, hooks);

    // --- Longitud de desarrollo de dowels (NSR-10 E.12.2 / E.12.3) ---
    const sCol = (2 * ((colA || 30) + (colB || 30))) / dNCol;      // espaciamiento aprox. en perímetro (cm)
    const cbDow = Math.min(dRec + dDbCol / 2, sCol / 2);
    const dev = Design.developmentLength(dDbCol, dFy, dFc, cbDow, { psiT: 1.0 });
    const devC = Design.developmentLengthComp(dDbCol, dFy, dFc);
    const voladizo = Math.min((dL - (colB || 30) / 100) / 2, (dB - (colA || 30) / 100) / 2) * 100;
    const lvAvail = dPedH + voladizo - dRec;

    const bear = Design.bearing(Pu || 58, colA || 30, colB || 30, dFc);

    const checks = [
      geoCheck[0].ok, geoCheck[1].ok, bearingULS.ok,
      punch.ok, shearX.ok, shearY.ok, flexX.ok, flexY.ok,
      rebarX.ok, rebarY.ok, bear.ok, dev.ld <= lvAvail
    ];
    const allOk = checks.every(c => c);

    current = {
      input, d, ecc, press, kern, pressU, bearingULS,
      geoCheck, bc, sliding, overturn, settle,
      punch, shearX, shearY, flexX, flexY,
      rebarX, rebarY, layout, steel, hooks,
      dev, devC, lvAvail, voladizo, bear,
      allOk, hasTop: hasTop || false,
      dbTopX: dbTopX || 1.27, dbTopY: dbTopY || 1.27, sTopX: sTopX || 25, sTopY: sTopY || 25,
      dbCol: dDbCol, nCol: dNCol
    };
    return current;
  }

  function optimize(input) {
    let best = null, bestScore = Infinity;
    const B0 = input.B || 1.8, L0 = input.L || 1.8, h0 = input.h || 0.45;
    for (const B of [B0 - 0.2, B0 - 0.1, B0, B0 + 0.1, B0 + 0.2, B0 + 0.3])
      for (const L of [L0 - 0.2, L0 - 0.1, L0, L0 + 0.1, L0 + 0.2, L0 + 0.3])
        for (const h of [h0 - 0.05, h0, h0 + 0.05, h0 + 0.1]) {
          if (B < 0.8 || L < 0.8 || h < 0.25) continue;
          const r = analyze({ ...input, B, L, h });
          if (!r.allOk) continue;
          const score = B * L * h * 2400 + r.steel.total * 5;
          if (score < bestScore) { bestScore = score; best = { B, L, h, result: r }; }
        }
    return best;
  }

  return { analyze, optimize, getCurrent: () => current };
})();