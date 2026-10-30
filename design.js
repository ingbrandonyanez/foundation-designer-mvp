/**
 * DESIGN.JS — NSR-10 Título E / ACI 318
 * Convención: dir 'x' = barras ∥ B (vuelo en B, ancho L) · dir 'y' = barras ∥ L (vuelo en L, ancho B)
 * φ cortante = 0.75 (E.9.4) · ρmin ZAPATAS = 0.0018 (E.10.5.4 / E.7.12, como el Excel)
 * ld tracción E.12.2 (Eq. 12-2) · ld compresión E.12.3
 */
const Design = (() => {

  function punching(Pu, bCol, hCol, d, fc, B, L) {
    if (!Pu || !bCol || !hCol || !d || !fc || !B || !L) return { b0: 0, Ac: 0, qu: 0, Vu: 0, Vc: 0, phiVc: 0, ratio: 0, ok: false };
    const phi = 0.75;
    const b0 = 2 * (bCol + d) + 2 * (hCol + d);
    const Ac = (bCol + d) * (hCol + d);
    const qu = Pu * 1000 / (B * L * 10000);
    const Vu = Pu * 1000 - qu * Ac;
    const beta_c = Math.max(bCol, hCol) / Math.min(bCol, hCol);
    const alpha_s = 40;
    const Vc1 = (1 + 2 / beta_c) * Math.sqrt(fc) * b0 * d / 3;
    const Vc2 = (alpha_s * d / b0 + 2) * Math.sqrt(fc) * b0 * d / 12;
    const Vc3 = 1.06 * Math.sqrt(fc) * b0 * d;
    const Vc = Math.min(Vc1, Vc2, Vc3);
    const phiVc = phi * Vc;
    const ratio = phiVc > 0 ? Vu / phiVc : 999;
    return { b0, Ac, qu, Vu, Vc, phiVc, ratio, ok: Vu <= phiVc && isFinite(Vu) && isFinite(phiVc) };
  }

  function oneWayShear(Pu, bCol, hCol, d, fc, B, L, dir) {
    if (!Pu || !bCol || !hCol || !d || !fc || !B || !L) return { lv: 0, Vu: 0, Vu_kg: 0, Vc: 0, phiVc: 0, ratio: 0, ok: false };
    const phi = 0.75;
    const qu = Pu / (B * L);
    const lv = (dir === 'x') ? (B / 2 - bCol / 200 - d / 100) : (L / 2 - hCol / 200 - d / 100);
    const width = (dir === 'x') ? L : B;
    if (lv <= 0) return { lv: 0, Vu: 0, Vu_kg: 0, Vc: 0, phiVc: 0, ratio: 0, ok: true };
    const Vu = qu * width * lv;
    const Vu_kg = Vu * 1000;
    const b = width * 100;
    const Vc = 0.53 * Math.sqrt(fc) * b * d;
    const phiVc = phi * Vc;
    const ratio = phiVc > 0 ? Vu_kg / phiVc : 999;
    return { lv: lv * 100, Vu, Vu_kg, Vc, phiVc, ratio, ok: Vu_kg <= phiVc && isFinite(Vu_kg) && isFinite(phiVc) };
  }

  /**
   * FLEXIÓN — ρmin de ZAPATA = 0.0018 (NSR-10 E.10.5.4 remite a E.7.12; igual al Excel de referencia)
   */
  function flexion(Pu, bCol, hCol, d, fc, fy, B, L, dir) {
    const result = { qu: 0, lv: 0, Mu: 0, Mu_kgcm: 0, Rn: 0, rhoReq: 0, rhoMin: 0, rhoMax: 0, rho: 0, AsReq: 0, AsMin: 0, bEff: 0, ok: false };
    if (!Pu || Pu <= 0 || !d || d <= 0 || !fc || fc <= 0 || !fy || fy <= 0 || !B || B <= 0 || !L || L <= 0) return result;
    const phi = 0.90;
    const qu = Pu / (B * L);
    const lv = (dir === 'x') ? (B - bCol / 100) / 2 : (L - hCol / 100) / 2;
    const width = (dir === 'x') ? L : B;
    // CORREGIDO: cuantía mínima de zapatas 0.0018 (no 14/fy)
    const rhoMin = (fy <= 4200) ? 0.0018 : 0.0018 * 4200 / fy;
    if (lv <= 0) {
      result.AsMin = rhoMin * width * 100 * d;
      result.AsReq = result.AsMin; result.rhoMin = rhoMin; result.ok = true; return result;
    }
    const Mu = qu * width * lv * lv / 2;
    const Mu_kgcm = Mu * 100000;
    const bEff = width * 100;
    const Rn = Mu_kgcm / (phi * bEff * d * d);
    const disc = 1 - 2 * Rn / (0.85 * fc);
    const rhoReq = disc < 0 ? 0 : (0.85 * fc / fy) * (1 - Math.sqrt(disc));
    const rhoMax = Geometry.rhoMax(fc, fy);
    let rho = Math.max(rhoReq, rhoMin);
    if (rho > rhoMax) rho = rhoMax;
    const AsReq = rho * bEff * d;
    const AsMin = rhoMin * bEff * d;
    const allFinite = [AsReq, AsMin, rho, Rn, Mu].every(v => isFinite(v));
    result.qu = qu; result.lv = lv * 100; result.Mu = Mu; result.Mu_kgcm = Mu_kgcm;
    result.Rn = Rn; result.rhoReq = rhoReq; result.rhoMin = rhoMin; result.rhoMax = rhoMax; result.rho = rho;
    result.AsReq = isFinite(AsReq) ? AsReq : AsMin;
    result.AsMin = isFinite(AsMin) ? AsMin : 0;
    result.bEff = bEff;
    result.ok = allFinite && AsReq > 0;
    return result;
  }

  function bearing(Pu, bCol, hCol, fc) {
    if (!Pu || !bCol || !hCol || !fc) return { A1: 0, Pn: 0, phiPn: 0, Pu_kg: 0, ratio: 0, ok: false };
    const phi = 0.65;
    const A1 = bCol * hCol;
    const Pn = 0.85 * fc * A1;
    const phiPn = phi * Pn;
    const Pu_kg = Pu * 1000;
    const ratio = phiPn > 0 ? Pu_kg / phiPn : 999;
    return { A1, Pn, phiPn, Pu_kg, ratio, ok: Pu_kg <= phiPn && isFinite(phiPn) };
  }

  /**
   * LONGITUD DE DESARROLLO EN TRACCIÓN — NSR-10 E.12.2 (Eq. 12-2)
   * ld = [fy/(3.51·λ·√f'c)]·[(ψt·ψe·ψs)/((cb+Ktr)/db)]·db ≥ 30 cm  (kg/cm², cm)
   */
  function developmentLength(db, fy, fc, cb, opts = {}) {
    if (!db || db <= 0 || !fy || fy <= 0 || !fc || fc <= 0) return { ld: 0, ldRaw: 0, psiT: 1, psiE: 1, psiS: 1, lambda: 1, cb: 0, conf: 0, Ktr: 0 };
    const psiT = (opts.psiT !== undefined) ? opts.psiT : 1.0;
    const psiE = (opts.psiE !== undefined) ? opts.psiE : 1.0;
    const psiS = (db <= 1.91) ? 0.8 : 1.0;
    const lambda = 1.0;
    const Ktr = 0.0;
    const conf = Math.min(2.5, (cb + Ktr) / db);
    const ldRaw = (fy / (3.51 * lambda * Math.sqrt(fc))) * ((psiT * psiE * psiS) / conf) * db;
    const ld = Math.max(ldRaw, 30);
    return { ld, ldRaw, psiT, psiE, psiS, lambda, cb, conf, Ktr };
  }

  /** LONGITUD DE DESARROLLO EN COMPRESIÓN — NSR-10 E.12.3 (dowels) */
  function developmentLengthComp(db, fy, fc) {
    if (!db || db <= 0 || !fy || fy <= 0 || !fc || fc <= 0) return { ldc: 0 };
    const a = (0.075 * fy / Math.sqrt(fc)) * db;
    const b = 0.0044 * fy * db;
    return { ldc: Math.max(a, b, 20) };
  }

  function sizeFooting(P, Mx, My, qa, colA, colB) {
    if (!P || P <= 0 || !qa || qa <= 0) return { B: 2, L: 2 };
    let B = Math.sqrt(P / qa), L = B;
    for (let i = 0; i < 20; i++) {
      const { ex, ey } = Geometry.eccentricities(P, Mx, My);
      B = Math.ceil(Math.max(colA / 100 + 2 * ex + 0.3, B) * 20) / 20;
      L = Math.ceil(Math.max(colB / 100 + 2 * ey + 0.3, L) * 20) / 20;
      const { qmax, qmin } = Geometry.contactPressures(P, Mx, My, B, L);
      if (qmax <= qa && qmin >= 0 && isFinite(qmax)) break;
      B += 0.05; L += 0.05;
    }
    return { B: isFinite(B) ? B : 2, L: isFinite(L) ? L : 2 };
  }

  return { punching, oneWayShear, flexion, bearing, developmentLength, developmentLengthComp, sizeFooting };
})();