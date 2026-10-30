/**
 * REINFORCEMENT.JS — Diseño de refuerzo con ganchos estándar
 * Soporte para refuerzo independiente en X e Y con ganchos a 90° o 180°
 */
const Reinforcement = (() => {

  // Longitudes de gancho estándar según NSR-10 (cm)
  const HOOK_LENGTHS = {
    '0.95': { '90': 15, '180': 12 },  // #3
    '1.27': { '90': 20, '180': 15 },  // #4
    '1.59': { '90': 25, '180': 18 },  // #5
    '1.91': { '90': 30, '180': 22 },  // #6
    '2.22': { '90': 35, '180': 25 },  // #7
    '2.54': { '90': 40, '180': 28 }   // #8
  };

  /**
   * Obtiene longitud de gancho estándar
   */
  function getHookLength(db, hookType) {
    const dbStr = db.toString();
    if (HOOK_LENGTHS[dbStr] && HOOK_LENGTHS[dbStr][hookType]) {
      return HOOK_LENGTHS[dbStr][hookType];
    }
    // Fallback: calcular según NSR-10
    if (hookType === '90') {
      return Math.max(12 * db, 6);
    } else {
      return Math.max(6 * db, 6);
    }
  }

  /**
   * Calcula As provisto dado diámetro y separación
   */
  function calcAsProvided(db, s, bEff) {
    const Ab = Geometry.barArea(db);
    const cover = 7.5;
    const n = Math.max(2, Math.ceil((bEff - 2 * cover) / s) + 1);
    const AsProv = n * Ab;
    return { n, AsProv, Ab };
  }

  /**
   * Verifica refuerzo en una dirección
   */
  function checkReinforcement(AsReq, AsMin, db, s, bEff) {
    const { n, AsProv, Ab } = calcAsProvided(db, s, bEff);
    const sMax = 45;
    const sMin = Math.max(2.5, db, 1.33 * 1.9);

    const AsReqValid = (isNaN(AsReq) || AsReq <= 0) ? AsMin : AsReq;
    const AsMinValid = (isNaN(AsMin) || AsMin <= 0) ? 0 : AsMin;

    const asOk = AsProv >= AsReqValid;
    const sMaxOk = s <= sMax;
    const sMinOk = s >= sMin;

    return {
      n, AsProv, Ab, db, s,
      sMax, sMin,
      AsReq: AsReqValid,
      AsMin: AsMinValid,
      ok: asOk && sMaxOk && sMinOk,
      checks: { asOk, sMaxOk, sMinOk }
    };
  }

  /**
   * Distribución de barras en la zapata
   */
  function layout(B, L, bCol, hCol, dbX, dbY, sX, sY, rec) {
    const cover = rec;

    const lvx = L * 100 - 2 * cover;
    const nX = Math.max(2, Math.floor(lvx / sX) + 1);
    const sXReal = lvx / (nX - 1);
    const lenX = B * 100 - 2 * cover;

    const lvy = B * 100 - 2 * cover;
    const nY = Math.max(2, Math.floor(lvy / sY) + 1);
    const sYReal = lvy / (nY - 1);
    const lenY = L * 100 - 2 * cover;

    return {
      x: { n: nY, s: sYReal, len: lenY, dir: 'L', db: dbY },
      y: { n: nX, s: sXReal, len: lenX, dir: 'B', db: dbX }
    };
  }

  /**
   * Tabla de acero con ganchos y refuerzo independiente
   */
  function steelTable(layout, dbX, dbY, h, hasTop, dbTopX, dbTopY, sTopX, sTopY, B, L, hooks) {
    const wX = Geometry.barWeight(dbX);
    const wY = Geometry.barWeight(dbY);

    const items = [];

    // Gancho X
    const hookLenX = hooks.hookX ? getHookLength(dbX, hooks.hookTypeX) : 0;
    const hookLenY = hooks.hookY ? getHookLength(dbY, hooks.hookTypeY) : 0;

    // Refuerzo inferior X
    items.push({
      mark: 'B1',
      desc: `Inf. Dir. X Ø${dbX}cm` + (hooks.hookX ? ` (${hooks.hookTypeX}°)` : ''),
      qty: layout.y.n,
      length: layout.y.len + hookLenX * 2,
      weight: (layout.y.len + hookLenX * 2) * layout.y.n * wX / 100
    });

    // Refuerzo inferior Y
    items.push({
      mark: 'B2',
      desc: `Inf. Dir. Y Ø${dbY}cm` + (hooks.hookY ? ` (${hooks.hookTypeY}°)` : ''),
      qty: layout.x.n,
      length: layout.x.len + hookLenY * 2,
      weight: (layout.x.len + hookLenY * 2) * layout.x.n * wY / 100
    });

    // Parrilla superior independiente
    if (hasTop) {
      const wTopX = Geometry.barWeight(dbTopX);
      const wTopY = Geometry.barWeight(dbTopY);

      const hookLenTopX = hooks.hookTopX ? getHookLength(dbTopX, hooks.hookTypeTopX) : 0;
      const hookLenTopY = hooks.hookTopY ? getHookLength(dbTopY, hooks.hookTypeTopY) : 0;

      const nTopX = Math.max(2, Math.floor((L * 100 - 15) / sTopX) + 1);
      const nTopY = Math.max(2, Math.floor((B * 100 - 15) / sTopY) + 1);
      const lenTopX = B * 100 - 15;
      const lenTopY = L * 100 - 15;

      items.push({
        mark: 'B3',
        desc: `Sup. Dir. X Ø${dbTopX}cm` + (hooks.hookTopX ? ` (${hooks.hookTypeTopX}°)` : ''),
        qty: nTopY,
        length: lenTopX + hookLenTopX * 2,
        weight: (lenTopX + hookLenTopX * 2) * nTopY * wTopX / 100
      });

      items.push({
        mark: 'B4',
        desc: `Sup. Dir. Y Ø${dbTopY}cm` + (hooks.hookTopY ? ` (${hooks.hookTypeTopY}°)` : ''),
        qty: nTopX,
        length: lenTopY + hookLenTopY * 2,
        weight: (lenTopY + hookLenTopY * 2) * nTopX * wTopY / 100
      });
    }

    const total = items.reduce((s, i) => s + i.weight, 0);
    return { items, total };
  }

  return { calcAsProvided, checkReinforcement, layout, steelTable, getHookLength };
})();