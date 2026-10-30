/**
 * GEOTECHNICAL.JS — Verificaciones geotécnicas
 * NSR-10 Título H · Capacidad portante · Estabilidad
 */
const Geotechnical = (() => {

    /**
     * Verificación de presiones de contacto
     * qmax ≤ qa  y  qmin ≥ 0
     */
    function checkPressures(qmax, qmin, qa) {
      const r1 = {
        name: 'qmax ≤ qa',
        demand: qmax,
        capacity: qa,
        ratio: qmax / qa,
        ok: qmax <= qa
      };
      const r2 = {
        name: 'qmin ≥ 0 (sin tracciones)',
        demand: qmin,
        capacity: 0,
        ratio: qmin >= 0 ? 1 : 0,
        ok: qmin >= 0
      };
      return [r1, r2];
    }
  
    /**
     * Capacidad portante última (Terzaghi, zapata rectangular)
     * qult = c'Nc·sc·dc + γDf·Nq·sq·dq + 0.5·γ·B'·Nγ·sγ·dγ
     */
    function bearingCapacity(cp, gamma, Df, B, L, phiDeg) {
      const phi = phiDeg * Math.PI / 180;
      // Factores de capacidad portante (Terzaghi-Meyerhof)
      const Nq = Math.exp(Math.PI * Math.tan(phi)) *
                 Math.pow(Math.tan(Math.PI/4 + phi/2), 2);
      const Nc = (Nq - 1) / Math.tan(phi || 1e-9);
      const Ngamma = 2 * (Nq + 1) * Math.tan(phi);
  
      // B' = B - 2*ex (ancho efectivo)
      const Bp = B; // se usa B completo en forma simplificada
  
      // Factores de forma
      const sq = 1 + Math.sin(phi) * (B / L);
      const sc = 1 + (Nq / Nc) * (B / L);
      const sgamma = 1 - 0.4 * (B / L);
  
      // Factores de profundidad
      const dq = 1 + 2 * Math.tan(phi) * (1 - Math.sin(phi)) ** 2 * (Df / B);
      const dc = 1 + 0.4 * (Df / B);
      const dgamma = 1;
  
      const qult = cp * Nc * sc * dc +
                   gamma * Df * Nq * sq * dq +
                   0.5 * gamma * Bp * Ngamma * sgamma * dgamma;
  
      const FS = 2.5; // factor de seguridad típico
      const qadm = qult / FS;
  
      return { qult, qadm, FS, Nc, Nq, Ngamma };
    }
  
    /**
     * Estabilidad al deslizamiento
     * Fd = μ·ΣV / ΣH  ≥  1.5
     */
    function slidingCheck(totalV, totalH, phiDeg) {
      const mu = Math.tan(phiDeg * Math.PI / 180) * 0.7; // reducción por adherencia
      const FS = totalV * mu / (totalH || 1e-9);
      return { FS, required: 1.5, ok: FS >= 1.5 };
    }
  
    /**
     * Estabilidad al volcamiento
     * Fe = ΣMres / ΣMvol  ≥  1.5
     */
    function overturningCheck(P, B, L, Mx, My) {
      const Mres_x = P * L / 2;
      const Mres_y = P * B / 2;
      const Fe_x = Mres_x / (Math.abs(Mx) || 1e-9);
      const Fe_y = Mres_y / (Math.abs(My) || 1e-9);
      return {
        Fe_x, Fe_y,
        required: 1.5,
        ok: Fe_x >= 1.5 && Fe_y >= 1.5
      };
    }
  
    /**
     * Asentamiento elástico simplificado (Meyerhof)
     * S = q·B·(1-2ν)/Es · Iw
     */
    function settlement(qnet, B, k) {
      // k = módulo de reacción (kg/cm³)
      // S ≈ qnet / k (cm)
      const S = qnet / k;
      return S;
    }
  
    return {
      checkPressures,
      bearingCapacity,
      slidingCheck,
      overturningCheck,
      settlement
    };
  
  })();