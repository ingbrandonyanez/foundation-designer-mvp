/**
 * REPORT.JS v2 — Memoria de cálculo auditada (formato corporativo tipo SAFE/ETABS/CYPE)
 * Paleta: navy #1F4E78 · light #D9EAF7 · verde #00B050 · ámbar #FFC000 · rojo #C00000 · gris #F2F2F2
 * Márgenes 25/25/25/20 mm · Secciones en página nueva · KPIs con utilización ·
 * Ecuaciones fraccionadas con sustitución · Auditoría normativa · DXF R12 completo
 */
const Report = (() => {
  // Colores hex para canvas (planta/cortes)
  const C = { blue:'#2563EB', red:'#DC2626', green:'#16A34A', amber:'#F59E0B', dark:'#1E293B', gray:'#94A3B8', black:'#000000', light:'#F8FAFC' };
  // Paleta RGB para PDF
  const PAL = { navy:[31,78,120], light:[217,234,247], green:[0,176,80], yellow:[255,192,0], red:[192,0,0], gray:[242,242,242], ink:[33,37,41], mut:[105,112,120], line:[198,206,214] };
  const ML=25, MR=20, MT=25, MB=25, PW=210, PH=297, CW=PW-ML-MR;
  const SEC_GAP=6.35, EQ_GAP=3.53;
  let doc, y, data, meta;

  const getBarLabel = (db) => {
    if (typeof Geometry !== 'undefined' && Geometry.barName) return Geometry.barName(db).split(' ')[0];
    if (db < 1.1) return '#3'; if (db < 1.5) return '#4'; if (db < 1.8) return '#5';
    if (db < 2.1) return '#6'; if (db < 2.4) return '#7'; return '#8';
  };

  function setupCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const connected = canvas.isConnected;
    const dpr = connected ? (window.devicePixelRatio || 1) : 1;
    const W = connected ? canvas.getBoundingClientRect().width : canvas.width;
    const H = connected ? canvas.getBoundingClientRect().height : canvas.height;
    if (connected) { canvas.width = W * dpr; canvas.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W, H };
  }

  /* ================= PRIMITIVAS PDF ================= */
  const setF=(c)=>doc.setFillColor(c[0],c[1],c[2]);
  const setDc=(c)=>doc.setDrawColor(c[0],c[1],c[2]);
  const F=(s,st,c)=>{doc.setFontSize(s);doc.setFont('helvetica',st||'normal');doc.setTextColor(c[0],c[1],c[2]);};
  const txt=(s,x,yy,sz,st,c,al)=>{F(sz,st,c);doc.text(s,x,yy,{align:al||'left'});};
  const mw=(s,sz)=>{doc.setFontSize(sz);doc.setFont('helvetica','normal');return doc.getTextWidth(s);};
  const box=(x,yy,w,h,fill,stroke,lw)=>{ if(fill)setF(fill); if(stroke){setDc(stroke);doc.setLineWidth(lw||0.35);} doc.rect(x,yy,w,h, fill&&stroke?'FD':(fill?'F':'S')); };
  const rule=(x,yy,w,c,lw)=>{setDc(c||PAL.line);doc.setLineWidth(lw||0.3);doc.line(x,yy,x+w,yy);};
  const ensure=(hgt)=>{ if(y+hgt>PH-MB){ doc.addPage(); y=MT; } };

  function pageHead(){
    txt(`MEMORIA DE CALCULO - ZAPATA ${meta.id}`, ML, 15, 8, 'bold', PAL.navy);
    txt('NSR-10 - Titulos B, C, E, H', ML+CW, 15, 8, 'normal', PAL.mut, 'right');
    rule(ML, 17.5, CW, PAL.navy, 0.6);
  }
  function section(num, title){
    doc.addPage(); pageHead(); y = MT + 2;
    box(ML, y, CW, 10, PAL.navy);
    txt(`${num}.  ${title}`, ML+4, y+6.8, 12.5, 'bold', [255,255,255]);
    txt(meta.project, ML+CW-4, y+6.8, 8, 'normal', PAL.light, 'right');
    y += 10 + SEC_GAP*0.7;
  }
  function eqRef(s){ ensure(6); txt(s, ML, y, 7.5, 'italic', PAL.mut); y += 4.0; }
  function subst(s){ ensure(5); doc.setFontSize(8.5); doc.setFont('courier','normal'); doc.setTextColor(PAL.mut[0],PAL.mut[1],PAL.mut[2]); doc.text(s, ML+4, y); y += 4.3; }
  function resLine(l, v, u){ ensure(6); txt(l, ML+4, y, 9.5, 'normal', PAL.ink); txt(`${v} ${u||''}`, ML+78, y, 9.5, 'bold', PAL.navy); y += 5.2; }
  function frac(x, yy, n, d, sz){
    sz = sz||9; F(sz,'normal',PAL.ink);
    const w = Math.max(doc.getTextWidth(n), doc.getTextWidth(d)) + 3;
    doc.text(n, x+w/2, yy, {align:'center'});
    setDc(PAL.ink); doc.setLineWidth(0.3); doc.line(x, yy+1.3, x+w, yy+1.3);
    doc.text(d, x+w/2, yy+5.4, {align:'center'});
    return w;
  }
  function eqRow(items){
    ensure(12); let x = ML; const y0 = y + 4;
    items.forEach(it => {
      if (it.t === 'f') { x += frac(x, y0, it.n, it.d, it.sz) + 2.5; }
      else { F(it.sz||10, it.st||'italic', PAL.ink); doc.text(it.v, x, y0+2); x += mw(it.v, it.sz||10) + 2.5; }
    });
    y += 10 + EQ_GAP*0.6;
  }
  function chipOK(ok, x, yy, util){
    const label = ok ? 'CUMPLE' : 'NO CUMPLE';
    const w = mw(label,7.5)+8;
    setF(ok?PAL.green:PAL.red); doc.roundedRect(x, yy-4.4, w, 5.6, 1.2, 1.2, 'F');
    txt(label, x+w/2, yy-0.4, 7.5, 'bold', [255,255,255], 'center');
    if (util !== undefined) txt(`Utilizacion ${util.toFixed(0)} %`, x+w+4, yy-0.4, 8, 'bold', ok?PAL.green:PAL.red);
    return w;
  }
  function diagRec(fail, diag, rec){
    if (!fail) return;
    ensure(16); const h = 13;
    box(ML+4, y, CW-8, h, [250,235,235], PAL.red, 0.3);
    txt('Diagnostico:', ML+7, y+4.5, 8, 'bold', PAL.red);
    txt(diag, ML+7, y+8.2, 8, 'normal', PAL.ink);
    txt('Recomendacion:', ML+7, y+11.4, 8, 'bold', PAL.navy);
    txt(rec, ML+42, y+11.4, 8, 'normal', PAL.ink);
    y += h + 3;
  }
  function kpi(x, yy, w, h, title, ok, dem, cap, unit, util){
    box(x, yy, w, h, [255,255,255], PAL.line, 0.35);
    box(x, yy, 3, h, ok?PAL.green:PAL.red);
    txt(title, x+6, yy+6, 8.5, 'bold', PAL.navy);
    const lab = ok?'CUMPLE':'NO CUMPLE'; const cw = mw(lab,7)+6;
    setF(ok?PAL.green:PAL.red); doc.roundedRect(x+w-cw-4, yy+2.5, cw, 5, 1, 1, 'F');
    txt(lab, x+w-cw/2-4, yy+6, 7, 'bold', [255,255,255], 'center');
    F(8,'normal',PAL.ink);
    doc.text(`Demanda   = ${dem} ${unit}`, x+6, yy+12);
    doc.text(`Capacidad = ${cap} ${unit}`, x+6, yy+16.5);
    F(9,'bold', ok?PAL.green:PAL.red);
    doc.text(`Utilizacion ${util.toFixed(0)} %`, x+6, yy+22);
  }
  function tableT(headers, widths, rows, fs){
    fs = fs||8.5;
    const rh = fs*0.62; const total = 7 + rows.length*rh;
    ensure(total);
    setF(PAL.navy); doc.rect(ML, y, CW, 7, 'F');
    F(fs,'bold',[255,255,255]);
    let x = ML; headers.forEach((hd,i)=>{ doc.text(hd, x+2, y+4.8); x+=widths[i]; });
    y += 7;
    rows.forEach((r,ri)=>{
      if (ri%2===0){ setF(PAL.gray); doc.rect(ML, y, CW, rh, 'F'); }
      F(fs,'normal',PAL.ink); x = ML;
      r.forEach((c,ci)=>{ doc.text(String(c), x+2, y+rh-1.6); x+=widths[ci]; });
      y += rh;
    });
    rule(ML, y, CW, PAL.line); y += 4;
  }

  /* ================= PLANTA (canvas) ================= */
  function drawPlan(canvas, d) {
    if (!d || !d.input) return;
    const { ctx, W, H } = setupCanvas(canvas);
    ctx.fillStyle = C.light; ctx.fillRect(0, 0, W, H);
    const I = d.input;
    const B = I.B || 1.8, L = I.L || 1.8, colA = I.colA || 30, colB = I.colB || 30;
    const pedA = I.pedA || colA, pedB = I.pedB || colB;
    const dbX = I.dbX || 1.27, dbY = I.dbY || 1.27, sX = I.sX || 20, sY = I.sY || 20, rec = I.rec || 7.5;
    const hasTop = d.hasTop || false;
    const dbTopX = d.dbTopX || 1.27, sTopX = d.sTopX || 25, dbTopY = d.dbTopY || 1.27, sTopY = d.sTopY || 25;

    const margin = 50, panelW = 240, topSpace = 80, rightSpace = 60;
    const drawW = W - margin - panelW - rightSpace, drawH = H - topSpace - margin;
    const sc = Math.min(drawW / (B + 1.2), drawH / (L + 1.2));
    const ox = (drawW - B * sc) / 2 + margin / 2, oy = (drawH - L * sc) / 2 + topSpace;
    const toX = m => ox + m * sc, toY = m => oy + m * sc;

    ctx.fillStyle = C.blue; ctx.font = 'bold 22px Segoe UI, Arial'; ctx.textAlign = 'center';
    ctx.fillText('PLANTA DE ZAPATA', ox + (B * sc) / 2, 35);
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = C.blue; ctx.lineWidth = 2;
    ctx.fillRect(toX(0), toY(0), B * sc, L * sc); ctx.strokeRect(toX(0), toY(0), B * sc, L * sc);

    const pedW = (pedA / 100) * sc, pedHd = (pedB / 100) * sc;
    const pedX = toX(B / 2) - pedW / 2, pedY = toY(L / 2) - pedHd / 2;
    ctx.strokeStyle = C.black; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.strokeRect(pedX, pedY, pedW, pedHd);
    ctx.fillStyle = C.black; ctx.font = 'bold 11px Arial';
    ctx.fillText(`Pedestal: ${pedA}x${pedB} cm`, toX(B / 2), pedY - 10);

    const colW = (colA / 100) * sc, colHd = (colB / 100) * sc;
    const colX = toX(B / 2) - colW / 2, colY = toY(L / 2) - colHd / 2;
    ctx.fillStyle = 'rgba(220,38,38,0.1)'; ctx.fillRect(colX, colY, colW, colHd);
    ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.strokeRect(colX, colY, colW, colHd);
    ctx.fillStyle = C.red; ctx.fillText(`${colA}x${colB} cm`, colX + colW / 2, colY + colHd / 2 + 4);

    ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 1; ctx.fillStyle = '#475569'; ctx.font = 'bold 12px Arial';
    const dimBy = oy - 25;
    ctx.beginPath(); ctx.moveTo(toX(0), dimBy); ctx.lineTo(toX(B), dimBy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(0), dimBy - 5); ctx.lineTo(toX(0), dimBy + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(B), dimBy - 5); ctx.lineTo(toX(B), dimBy + 5); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillText(`B = ${B.toFixed(2)} m`, toX(B / 2), dimBy - 8);
    const dimLx = ox + B * sc + 35;
    ctx.beginPath(); ctx.moveTo(dimLx, toY(0)); ctx.lineTo(dimLx, toY(L)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dimLx - 5, toY(0)); ctx.lineTo(dimLx + 5, toY(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dimLx - 5, toY(L)); ctx.lineTo(dimLx + 5, toY(L)); ctx.stroke();
    ctx.save(); ctx.translate(dimLx + 18, toY(L / 2)); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillText(`L = ${L.toFixed(2)} m`, 0, 0); ctx.restore();

    const x0 = toX(rec / 100), x1 = toX(B - rec / 100), y0 = toY(rec / 100), y1 = toY(L - rec / 100);
    ctx.setLineDash([]);
    const nX = Math.floor((L - 2 * rec / 100) / (sX / 100)) + 1, stepY = (y1 - y0) / (nX > 1 ? nX - 1 : 1);
    const nY = Math.floor((B - 2 * rec / 100) / (sY / 100)) + 1, stepX = (x1 - x0) / (nY > 1 ? nY - 1 : 1);
    ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < nX; i++) { ctx.moveTo(x0, y0 + i * stepY); ctx.lineTo(x1, y0 + i * stepY); } ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < nY; i++) { ctx.moveTo(x0 + i * stepX, y0); ctx.lineTo(x0 + i * stepX, y1); } ctx.stroke();
    if (hasTop) {
      ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      const nTX = Math.floor((L - 2 * rec / 100) / (sTopX / 100)) + 1, sYT = (y1 - y0) / (nTX > 1 ? nTX - 1 : 1);
      const nTY = Math.floor((B - 2 * rec / 100) / (sTopY / 100)) + 1, sXT = (x1 - x0) / (nTY > 1 ? nTY - 1 : 1);
      ctx.beginPath(); for (let i = 0; i < nTX; i++) { ctx.moveTo(x0 + 3, y0 + i * sYT); ctx.lineTo(x1 - 3, y0 + i * sYT); } ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < nTY; i++) { ctx.moveTo(x0 + i * sXT, y0 + 3); ctx.lineTo(x0 + i * sXT, y1 - 3); } ctx.stroke();
      ctx.setLineDash([]);
    }

    const px = W - panelW + 10, py = 20, ph = H - 40;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(px, py, panelW - 20, ph);
    ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1; ctx.strokeRect(px, py, panelW - 20, ph);
    ctx.fillStyle = C.dark; ctx.font = 'bold 14px Segoe UI, Arial'; ctx.textAlign = 'left';
    ctx.fillText('DETALLE DE ACERO', px + 10, py + 25);
    let ty = py + 55; const lh = 26;
    ctx.fillStyle = C.green; ctx.beginPath(); ctx.arc(px + 15, ty, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#334155'; ctx.font = 'bold 13px Arial'; ctx.fillText('INFERIOR', px + 25, ty + 4); ty += lh;
    ctx.font = '13px Arial'; ctx.fillStyle = '#475569';
    ctx.fillText(`Dir X: ${getBarLabel(dbX)} @ ${sX} cm`, px + 25, ty); ty += lh - 4;
    ctx.fillText(`Dir Y: ${getBarLabel(dbY)} @ ${sY} cm`, px + 25, ty); ty += lh + 15;
    if (hasTop) {
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(px + 15, ty, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#334155'; ctx.font = 'bold 13px Arial'; ctx.fillText('SUPERIOR', px + 25, ty + 4); ty += lh;
      ctx.font = '13px Arial'; ctx.fillStyle = '#475569';
      ctx.fillText(`Dir X: ${getBarLabel(dbTopX)} @ ${sTopX} cm`, px + 25, ty); ty += lh - 4;
      ctx.fillText(`Dir Y: ${getBarLabel(dbTopY)} @ ${sTopY} cm`, px + 25, ty);
    }
  }

  /* ================= CORTES (canvas) ================= */
  function drawSection(canvas, d) {
    if (!d || !d.input) return;
    const { ctx, W, H } = setupCanvas(canvas);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    const I = d.input;
    const B = I.B || 1.8, L = I.L || 1.8, h = I.h || 0.45;
    const colA = I.colA || 30, colB = I.colB || 30;
    const pedA = I.pedA || colA, pedB = I.pedB || colB, pedH = I.pedH || 60;
    const sol = I.sol || 5, rec = I.rec || 7.5, Df = I.Df || 1.5;
    const dbX = I.dbX || 1.27, dbY = I.dbY || 1.27, sX = I.sX || 20, sY = I.sY || 20;
    const hasTop = d.hasTop || false;
    const dbTopX = d.dbTopX || 1.27, dbTopY = d.dbTopY || 1.27, sTopX = d.sTopX || 25, sTopY = d.sTopY || 25;
    const hooks = d.hooks || {};

    const mandrelR = (db) => {
      const T = { '1.00':3.00,'1.27':3.60,'1.59':4.80,'1.91':6.00,'2.22':4.50,'2.54':5.00,'2.87':6.00,'3.23':6.00 };
      return (T[db.toFixed(2)] || 3 * db) / 100;
    };

    const gap = 2.0, totalW = B + L + gap;
    const maxH = Math.max(Df + 1.0, h + pedH / 100 + 2.5);
    const sc = Math.min((W - 80) / totalW, (H - 120) / maxH);
    const drawW = totalW * sc, drawH = maxH * sc;
    const originX = (W - drawW) / 2, originY = (H - drawH) / 2;
    const baseY = originY + drawH - 20;

    const drawOneCut = (localX, dim, title, dimLabel, isDirX) => {
      const w = dim * sc, centerX = localX + w / 2;
      const toY = yy => baseY - yy * sc;

      ctx.fillStyle = C.dark; ctx.font = 'bold 16px Segoe UI, Arial'; ctx.textAlign = 'center';
      ctx.fillText(title, centerX, originY + 25);

      ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(localX - 20, toY(Df)); ctx.lineTo(localX + w + 20, toY(Df)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.gray; ctx.font = '10px Arial';
      if (!isDirX) { ctx.textAlign = 'right'; ctx.fillText(`NPT (-${Df.toFixed(2)}m)`, localX - 10, toY(Df) + 3); }
      else { ctx.textAlign = 'left'; ctx.fillText(`NPT (-${Df.toFixed(2)}m)`, localX + w + 25, toY(Df) + 3); }

      ctx.fillStyle = 'rgba(37,99,235,0.1)'; ctx.fillRect(localX, toY(h), w, h * sc);
      ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.strokeRect(localX, toY(h), w, h * sc);
      ctx.fillStyle = '#E2E8F0'; ctx.fillRect(localX - 5, baseY, w + 10, (sol / 100) * sc);

      const pw = (isDirX ? pedA : pedB) / 100 * sc, phh = pedH / 100 * sc, yPT = h + pedH / 100;
      ctx.fillStyle = 'rgba(37,99,235,0.2)'; ctx.fillRect(centerX - pw / 2, toY(yPT), pw, phh);
      ctx.strokeStyle = C.blue; ctx.lineWidth = 1.5; ctx.strokeRect(centerX - pw / 2, toY(yPT), pw, phh);
      const cw = (isDirX ? colA : colB) / 100 * sc, chh = 1.5 * sc;
      ctx.fillStyle = 'rgba(220,38,38,0.2)'; ctx.fillRect(centerX - cw / 2, toY(yPT + 1.5), cw, chh);
      ctx.strokeStyle = C.red; ctx.strokeRect(centerX - cw / 2, toY(yPT + 1.5), cw, chh);

      const yX = baseY - (rec / 100 + dbX / 200) * sc;
      const yY = baseY - (rec / 100 + dbX / 100 + dbY / 200) * sc;
      const yTopX = toY(h) + (rec / 100 + dbTopX / 200) * sc;
      const yTopY = toY(h) + (rec / 100 + dbTopX / 100 + dbTopY / 200) * sc;
      const xS = localX + (rec / 100) * sc, xE = localX + w - (rec / 100) * sc;

      const drawHookEnd = (x, yy, db, type, side, top) => {
        if (type === 180) {
          const Rpx = mandrelR(db) * sc;
          const tail = Math.max(4 * db / 100, 0.07) * sc;
          ctx.beginPath(); ctx.moveTo(x, yy);
          if (!top) {
            if (side < 0) { ctx.arc(x, yy - Rpx, Rpx, Math.PI / 2, Math.PI * 1.5, false); ctx.lineTo(x + tail, yy - 2 * Rpx); }
            else { ctx.arc(x, yy - Rpx, Rpx, Math.PI / 2, -Math.PI / 2, true); ctx.lineTo(x - tail, yy - 2 * Rpx); }
          } else {
            if (side < 0) { ctx.arc(x, yy + Rpx, Rpx, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(x + tail, yy + 2 * Rpx); }
            else { ctx.arc(x, yy + Rpx, Rpx, -Math.PI / 2, Math.PI / 2, false); ctx.lineTo(x - tail, yy + 2 * Rpx); }
          }
          ctx.stroke();
        } else {
          const hl = Math.max(12 * db / 100, 0.15) * sc;
          ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x, top ? yy + hl : yy - hl); ctx.stroke();
        }
      };

      const drawDots = (yLevel, dbDot, sep, color) => {
        ctx.fillStyle = color;
        const usable = dim - 2 * rec / 100;
        const n = Math.max(2, Math.floor(usable / (sep / 100)) + 1);
        const step = usable / (n - 1);
        const rDot = Math.max((dbDot / 200) * sc, 1.5);
        for (let i = 0; i < n; i++) {
          const x = localX + (rec / 100 + i * step) * sc;
          ctx.beginPath(); ctx.arc(x, yLevel, rDot, 0, Math.PI * 2); ctx.fill();
        }
      };

      const dbL = isDirX ? dbX : dbY, yL = isDirX ? yX : yY;
      const hookL = isDirX ? hooks.hookX : hooks.hookY;
      const typeL = isDirX ? (hooks.hookTypeX || 90) : (hooks.hookTypeY || 90);
      ctx.strokeStyle = C.green; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(xS, yL); ctx.lineTo(xE, yL); ctx.stroke();
      ctx.lineWidth = 2;
      if (hookL) { drawHookEnd(xS, yL, dbL, typeL, -1, false); drawHookEnd(xE, yL, dbL, typeL, +1, false); }
      drawDots(isDirX ? yY : yX, isDirX ? dbY : dbX, isDirX ? sY : sX, C.green);

      if (hasTop) {
        const dbLT = isDirX ? dbTopX : dbTopY, yLT = isDirX ? yTopX : yTopY;
        const hookLT = isDirX ? hooks.hookTopX : hooks.hookTopY;
        const typeLT = isDirX ? (hooks.hookTypeTopX || 90) : (hooks.hookTypeTopY || 90);
        ctx.strokeStyle = C.amber; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(xS, yLT); ctx.lineTo(xE, yLT); ctx.stroke();
        ctx.lineWidth = 2;
        if (hookLT) { drawHookEnd(xS, yLT, dbLT, typeLT, -1, true); drawHookEnd(xE, yLT, dbLT, typeLT, +1, true); }
        drawDots(isDirX ? yTopY : yTopX, isDirX ? dbTopY : dbTopX, isDirX ? sTopY : sTopX, C.amber);
      }

      ctx.fillStyle = '#334155'; ctx.font = 'bold 11px Arial';
      const dX = localX + w + 15;
      ctx.strokeStyle = C.gray; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(dX, toY(h)); ctx.lineTo(dX, baseY); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(dX + 10, (toY(h) + baseY) / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.fillText(`h = ${(h * 100).toFixed(0)} cm`, 0, 0); ctx.restore();

      ctx.textAlign = 'center'; ctx.fillStyle = C.dark; ctx.font = 'bold 12px Arial';
      ctx.fillText(`${dimLabel} = ${dim.toFixed(2)} m`, centerX, baseY + 15);
      ctx.font = '10px Arial'; ctx.fillStyle = C.green;
      ctx.fillText(`Inf: ${getBarLabel(isDirX ? dbX : dbY)} @ ${isDirX ? sX : sY} cm`, centerX, baseY + 30);
      if (hasTop) { ctx.fillStyle = C.amber; ctx.fillText(`Sup: ${getBarLabel(isDirX ? dbTopX : dbTopY)} @ ${isDirX ? sTopX : sTopY} cm`, centerX, baseY + 42); }
      ctx.fillStyle = C.gray; ctx.font = '9px Arial';
      ctx.fillText('— longitudinal   ● transversal', centerX, baseY + 54);
      return w;
    };

    let cx = originX;
    cx += drawOneCut(cx, B, 'CORTE A-A', 'B', true);
    cx += gap * sc;
    cx += drawOneCut(cx, L, 'CORTE B-B', 'L', false);
  }

  /* ================= PRESIONES (Plotly) ================= */
  function plotPressures(divId, d) {
    if (!d || !window.Plotly) return;
    const B = d.input.B, qmax = d.press.qmax, qmin = d.press.qmin, qa = d.input.qa;
    Plotly.newPlot(divId, [
      { x: [-B/2,0,B/2], y: [qmin,(qmax+qmin)/2,qmax], type:'scatter', mode:'lines+markers', fill:'tozeroy', fillcolor:'rgba(37,99,235,0.4)', line:{color:C.blue,width:3}, marker:{size:10}, name:'q contacto' },
      { x: [-B/2,B/2], y: [qa,qa], mode:'lines', line:{color:C.red,dash:'dash',width:2}, name:`qa = ${qa} kg/cm2` }
    ], { paper_bgcolor:'white', plot_bgcolor:'#f8fafc', font:{color:'#1e293b',family:'Arial'}, title:{text:'Distribucion de Presiones',font:{size:16,color:C.blue}}, xaxis:{title:'x (m)',gridcolor:'#cbd5e1'}, yaxis:{title:'q (kg/cm2)',gridcolor:'#cbd5e1'}, margin:{t:50,b:50,l:70,r:30}, showlegend:true }, { responsive:true, displayModeBar:false });
  }

  /* ================= MEMORIA PDF v2 ================= */
  async function generatePDF(d0) {
    if (!d0 || !d0.input) { alert('Primero ejecute un calculo.'); return; }
    data = d0;
    meta = data.meta || { project:'Proyecto Estructural', id:'Z1', date:new Date().toISOString().slice(0,10), elaboro:'Ing. Calculista', reviso:'Ing. Revisor' };
    const { jsPDF } = window.jspdf;
    doc = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait' });

    const I = data.input;
    const B=I.B, L=I.L, h=I.h, rec=I.rec, b1=I.colA, b2=I.colB;
    const pedA=I.pedA||b1, pedB=I.pedB||b2, pedH=I.pedH, sol=I.sol, Df=I.Df;
    const fc=I.fc, fy=I.fy, qa=I.qa, P=I.P, Pu=I.Pu, Mx=I.Mx, My=I.My;
    const dcm=data.d, dm=dcm/100;
    const pr=data.press, kern=data.kern, buls=data.bearingULS;
    const quT = Pu/(B*L), qukg = quT/10;
    const sx=data.shearX, sy=data.shearY, pu=data.punch, fx=data.flexX, fy2=data.flexY;
    const VuX=sx.Vu, VuY=sy.Vu, fVcX=sx.phiVc/1000, fVcY=sy.phiVc/1000;
    const VuP=pu.Vu/1000, fVcP=pu.phiVc/1000;
    const bo=pu.b0, Ac=pu.Ac;
    const sqrtfc=Math.sqrt(fc), mFy=fy/(0.85*fc);
    const beta=Math.max(b1,b2)/Math.min(b1,b2);
    const e1=0.75*0.17*(1+2/beta)*sqrtfc*bo*dcm/1000;
    const e2=0.75*0.083*(40*dcm/bo+2)*sqrtfc*bo*dcm/1000;
    const e3=0.75*0.33*sqrtfc*bo*dcm/1000;
    const rhoMin=(fy<=4200)?0.0018:0.0018*4200/fy;
    const dev=data.dev, devC=data.devC, lvAv=data.lvAvail, bear=data.bear;
    const slide=data.sliding, ov=data.overturn;
    const bearUT=(bear.Pu_kg/1000)/(bear.phiPn/1000)*100;

    const KPIS = [
      ['CAPACIDAD PORTANTE', pr.qmax<=qa, pr.qmax.toFixed(2), qa.toFixed(2), 'kg/cm2', pr.qmax/qa*100, 'La presion de servicio supera la admisible del suelo.', 'Aumente B y L o incremente Df / mejore el suelo.'],
      ['PUNZONAMIENTO', pu.ok, VuP.toFixed(2), fVcP.toFixed(2), 'Ton', VuP/fVcP*100, 'El espesor actual es insuficiente para el cortante bidireccional.', `Aumente h de ${(h*100).toFixed(0)} cm a ${(h*100+15).toFixed(0)} cm y verifique de nuevo.`],
      ['CORTANTE X', sx.ok, VuX.toFixed(2), fVcX.toFixed(2), 'Ton', VuX/fVcX*100, 'Seccion insuficiente para cortante unidireccional en X.', 'Aumente h o el ancho de la zapata en direccion B.'],
      ['CORTANTE Y', sy.ok, VuY.toFixed(2), fVcY.toFixed(2), 'Ton', VuY/fVcY*100, 'Seccion insuficiente para cortante unidireccional en Y.', 'Aumente h o el ancho de la zapata en direccion L.'],
      ['FLEXION X', data.rebarX.checks.asOk, fx.AsReq.toFixed(2), data.rebarX.AsProv.toFixed(2), 'cm2', fx.AsReq/data.rebarX.AsProv*100, 'El acero suministrado en X es inferior al requerido.', 'Reduzca separacion o aumente diametro de barras paralelas a B.'],
      ['FLEXION Y', data.rebarY.checks.asOk, fy2.AsReq.toFixed(2), data.rebarY.AsProv.toFixed(2), 'cm2', fy2.AsReq/data.rebarY.AsProv*100, 'El acero suministrado en Y es inferior al requerido.', 'Reduzca separacion o aumente diametro de barras paralelas a L.'],
      ['DESARROLLO', dev.ld<=lvAv, dev.ld.toFixed(1), lvAv.toFixed(1), 'cm', dev.ld/lvAv*100, 'Longitud de desarrollo de dowels insuficiente.', 'Aumente pedH o use ganchos / plancha de arranque.'],
      ['APLASTAMIENTO', bear.ok, (bear.Pu_kg/1000).toFixed(2), (bear.phiPn/1000).toFixed(2), 'Ton', bearUT, 'Aplastamiento de la columna sobre el pedestal es critico.', 'Aumente seccion de columna o use dowels con platina.'],
      ['DESLIZAMIENTO', slide.ok, '1.50', slide.FS.toFixed(2), 'FS', 1.5/slide.FS*100, 'Seguridad al deslizamiento insuficiente.', 'Aumente B o disponga llave de cortante.'],
      ['VOLCAMIENTO', ov.Fe_x>=1.5, '1.50', Math.min(ov.Fe_x,ov.Fe_y).toFixed(2), 'FS', 1.5/Math.min(ov.Fe_x,ov.Fe_y)*100, 'Seguridad al volcamiento insuficiente.', 'Aumente B y L o reduzca excentricidades.']
    ];
    const nOK = KPIS.filter(kk=>kk[1]).length;

    /* ---- PORTADA ---- */
    setF(PAL.navy); doc.rect(0,0,PW,60,'F');
    txt('MEMORIA DE CALCULO', PW/2, 26, 24, 'bold', [255,255,255], 'center');
    txt(`ZAPATA ${meta.id}  -  CIMENTACION SUPERFICIAL`, PW/2, 36, 12, 'normal', PAL.light, 'center');
    txt('NSR-10 - Titulos B, C, E, H  -  ACI 318 equivalente', PW/2, 44, 9, 'normal', PAL.light, 'center');
    txt('Documento auditado - version 2.0', PW/2, 52, 8, 'italic', PAL.light, 'center');
    y = 74;
    tableT(['DATOS GENERALES',''], [70,95], [
      ['Proyecto', meta.project], ['Elaboro', meta.elaboro], ['Reviso', meta.reviso],
      ['Fecha', meta.date], ['Codigo de hoja', `MC-${meta.id}-01`],
      ['Sistema de unidades', 'Ton, kg/cm2, m, cm'],
      ['Software', 'FoundationPro NSR-10 (motor propio auditado)']
    ], 9);
    y += 2;
    eqRef('Marco normativo aplicado');
    subst('NSR-10 Titulo B (estudios geotecnicos) y Titulo H (cimentaciones)');
    subst('NSR-10 Titulo C / E (concreto): C.9-C.12, C.15  (equiv. E.9-E.12, E.15)');
    subst('ACI 318-05 equivalente: Cap. 9, 10, 11, 12, 15');

    /* ---- 2 GEOMETRIA ---- */
    section(2, 'GEOMETRIA');
    tableT(['Parametro','Valor','Unidad','Nota'], [60,30,20,55], [
      ['Ancho B', B.toFixed(2), 'm', ''], ['Largo L', L.toFixed(2), 'm', B===L?'Zapata cuadrada':'Zapata rectangular'],
      ['Espesor h', (h*100).toFixed(0), 'cm', 'Asumido inicialmente'], ['Recubrimiento', rec.toFixed(1), 'cm', ''],
      ['d = h - rec - Db/2', dcm.toFixed(2), 'cm', 'Sin estribo (criterio del curso)'],
      ['Columna b1 x b2', `${b1} x ${b2}`, 'cm', ''], ['Pedestal', `${pedA} x ${pedB} x ${pedH}`, 'cm', ''],
      ['Solado', sol.toFixed(0), 'cm', ''], ['Profundidad Df', Df.toFixed(2), 'm', 'NPT']
    ]);
    eqRef('NSR-10 C.15 / E.15 - peralte efectivo');
    eqRow([{t:'s',v:'d = h - rec - Db/2',st:'normal'}]);
    subst(`d = ${h*100} - ${rec} - ${Math.max(I.dbX,I.dbY)/2} = ${dcm.toFixed(2)} cm`);

    /* ---- 3 CARGAS ---- */
    section(3, 'CARGAS');
    tableT(['Carga de servicio','Valor (Ton)'], [80,40], [['P', P.toFixed(2)],['Mx', I.Mx.toFixed(2)],['My', I.My.toFixed(2)],['Hx', I.Hx.toFixed(2)],['Hy', I.Hy.toFixed(2)]]);
    tableT(['Carga factorizada (ingresada)','Valor (Ton)'], [80,40], [['Pu', Pu.toFixed(2)],['Mux', I.Mux.toFixed(2)],['Muy', I.Muy.toFixed(2)],['Qux', I.Hux.toFixed(2)],['Quy', I.Huy.toFixed(2)]]);
    eqRef('NSR-10 C.9 / E.9.2 - combinaciones');
    subst('Pu ingresado por el usuario; verificar que corresponda a la combinacion gobernante  (!) auditoria');

    /* ---- 4 CAPACIDAD PORTANTE ---- */
    section(4, 'CAPACIDAD PORTANTE');
    eqRef('NSR-10 Titulo H / B.6 - Terzaghi-Meyerhof');
    eqRow([{t:'s',v:'qult = c*Nc*sc*dc + gamma*Df*Nq*sq*dq + 0.5*gamma*B*Ngamma*sgamma*dgamma',sz:8.5,st:'normal'}]);
    resLine('qult', data.bc.qult.toFixed(2), 'kg/cm2');
    resLine('qadm = qult / FS', data.bc.qadm.toFixed(2), `kg/cm2  (FS = ${data.bc.FS})`);
    chipOK(pr.qmax<=data.bc.qadm, ML+4, y+4, pr.qmax/data.bc.qadm*100); txt('ELS: qmax <= qadm', ML+42, y+4, 9,'normal',PAL.ink); y+=8;
    chipOK(buls.ok, ML+4, y+4, buls.demand/buls.capacity*100); txt('ELU suelo: qmax_u <= qult', ML+42, y+4, 9,'normal',PAL.ink); y+=9;
    diagRec(!buls.ok, 'La demanda ultima supera la capacidad ultima del suelo.', 'Aumente B, L o Df; verifique tambien ELS.');

    /* ---- 5 PRESIONES DE CONTACTO ---- */
    section(5, 'PRESIONES DE CONTACTO');
    eqRef('NSR-10 C.15 / E.15 - distribucion lineal (valida dentro del nucleo)');
    eqRow([{t:'s',v:'q = '},{t:'f',n:'P',d:'B*L'},{t:'s',v:' +/- '},{t:'f',n:'6*Mx',d:'L*B^2'},{t:'s',v:' +/- '},{t:'f',n:'6*My',d:'B*L^2'}]);
    subst(`q = ${P}/(${B}*${L}) +/- 6*${Mx}/(${L}*${B}^2) +/- 6*${My}/(${B}*${L}^2)   [Ton/m2]`);
    subst(`qmax = ${pr.qmax.toFixed(3)} kg/cm2    qmin = ${pr.qmin.toFixed(3)} kg/cm2    (conversion /10)`);
    chipOK(pr.qmax<=qa, ML+4, y+4, pr.qmax/qa*100); txt('qmax <= qa', ML+42, y+4, 9,'normal',PAL.ink); y+=8;
    chipOK(pr.qmin>=0, ML+4, y+4); txt('qmin >= 0 (sin despegue)', ML+42, y+4, 9,'normal',PAL.ink); y+=8;
    chipOK(kern.ok, ML+4, y+4); txt(`Nucleo: ex=${kern.ex.toFixed(3)} <= L/6=${kern.exLim.toFixed(3)} ; ey=${kern.ey.toFixed(3)} <= B/6=${kern.eyLim.toFixed(3)}`, ML+42, y+4, 8,'normal',PAL.ink); y+=10;
    kpi(ML, y, 85, 26, 'CAPACIDAD PORTANTE (ELS)', pr.qmax<=qa, pr.qmax.toFixed(2), qa.toFixed(2), 'kg/cm2', pr.qmax/qa*100);
    y+=30;
    diagRec(pr.qmax>qa, 'La presion de servicio supera la admisible del suelo.', 'Aumente B y L o incremente Df.');

    /* ---- 6 CORTANTE UNIDIRECCIONAL ---- */
    section(6, 'CORTANTE UNIDIRECCIONAL');
    [['X', sx, VuX, fVcX, 'B', 'L'], ['Y', sy, VuY, fVcY, 'L', 'B']].forEach(([dir, s, Vu, fVc, wdim, sdim]) => {
      ensure(48);
      txt(`Direccion ${dir}  (barras paralelas a ${wdim}, ancho resistente ${sdim} = ${sdim==='L'?L:B} m)`, ML, y, 10, 'bold', PAL.navy); y+=6;
      eqRef('NSR-10 C.11 / E.11.3 - phi_v = 0.75');
      eqRow([{t:'s',v:`lv = ${wdim==='B'?'B/2 - b1/2 - d':'L/2 - b2/2 - d'} = `},{t:'s',v:s.lv.toFixed(1),st:'normal'},{t:'s',v:' cm',st:'normal'}]);
      eqRow([{t:'s',v:`Vu = qu*${sdim}*lv = `},{t:'s',v:Vu.toFixed(2),st:'normal'},{t:'s',v:' Ton',st:'normal'}]);
      eqRow([{t:'s',v:`phiVc = 0.75*0.53*raiz(f'c)*${sdim}*d = `},{t:'s',v:fVc.toFixed(2),st:'normal'},{t:'s',v:' Ton',st:'normal'}]);
      eqRow([{t:'s',v:'Indice = '},{t:'f',n:'Vu',d:'phiVc'},{t:'s',v:' = '},{t:'s',v:s.ratio.toFixed(2),st:'normal'}]);
      chipOK(s.ok, ML+4, y+4, s.ratio*100); y+=10;
      diagRec(!s.ok, `Demanda de cortante unidireccional en ${dir} excesiva.`, 'Aumente h o el ancho de la zapata.');
      y+=2;
    });

    /* ---- 7 PUNZONAMIENTO ---- */
    section(7, 'PUNZONAMIENTO (CORTANTE BIDIRECCIONAL)');
    eqRef('NSR-10 C.11.11 / C.15 (E.11.11, E.15) - alpha_s = 40 interior, beta, lambda = 1');
    eqRow([{t:'s',v:'bo = 2(b1+d+b2+d) = '},{t:'s',v:bo.toFixed(1),st:'normal'},{t:'s',v:' cm',st:'normal'}]);
    eqRow([{t:'s',v:'Ac = (b1+d)(b2+d) = '},{t:'s',v:Ac.toFixed(0),st:'normal'},{t:'s',v:' cm2',st:'normal'}]);
    eqRow([{t:'s',v:'Vu = Pu - qu*Ac = '},{t:'s',v:VuP.toFixed(2),st:'normal'},{t:'s',v:' Ton',st:'normal'}]);
    subst(`qu = ${Pu}*1000/(${B}*${L}*10^4) = ${qukg.toFixed(3)} kg/cm2`);
    txt('phiVc = menor de:', ML+4, y, 9.5, 'bold', PAL.ink); y+=5;
    eqRow([{t:'s',v:'phi*0.17*(1+2/beta)*raiz(f\'c)*bo*d = '},{t:'s',v:e1.toFixed(2),st:'normal'},{t:'s',v:' Ton',st:'normal'}]);
    eqRow([{t:'s',v:'phi*0.083*(alpha_s*d/bo+2)*raiz(f\'c)*bo*d = '},{t:'s',v:e2.toFixed(2),st:'normal'},{t:'s',v:' Ton',st:'normal'}]);
    eqRow([{t:'s',v:'phi*0.33*raiz(f\'c)*bo*d = '},{t:'s',v:e3.toFixed(2),st:'normal'},{t:'s',v:' Ton',st:'normal'}]);
    subst(`Gobernante phiVc = ${fVcP.toFixed(2)} Ton`);
    eqRow([{t:'s',v:'Indice = '},{t:'f',n:'Vu',d:'phiVc'},{t:'s',v:' = '},{t:'s',v:pu.ratio.toFixed(2),st:'normal'}]);
    chipOK(pu.ok, ML+4, y+4, pu.ratio*100); y+=10;
    diagRec(!pu.ok, 'El espesor actual de la zapata es insuficiente para resistir punzonamiento.', `Aumente h de ${(h*100).toFixed(0)} cm a ${(h*100+15).toFixed(0)} cm y vuelva a verificar.`);

    /* ---- 8 FLEXION ---- */
    section(8, 'FLEXION Y CUANTIAS');
    [['X', fx, 'B', 'L', data.rebarX], ['Y', fy2, 'L', 'B', data.rebarY]].forEach(([dir, f, wdim, sdim, rb]) => {
      ensure(46);
      txt(`Direccion ${dir} - barras paralelas a ${wdim} (ancho tributario ${sdim} = ${sdim==='L'?L:B} m)`, ML, y, 10, 'bold', PAL.navy); y+=6;
      eqRef('NSR-10 C.15 / E.15.5 - momento en la cara de la columna');
      eqRow([{t:'s',v:`Mu = qu*${sdim}*lv^2/2 = `},{t:'s',v:f.Mu.toFixed(2),st:'normal'},{t:'s',v:' Ton*m',st:'normal'}]);
      eqRef('NSR-10 C.10 / E.10.3 - phi = 0.90');
      eqRow([{t:'s',v:'k = '},{t:'f',n:'Mu',d:'phi*b*d^2'},{t:'s',v:'    m = '},{t:'f',n:'fy',d:"0.85*f'c"},{t:'s',v:'    rho = (1/m)(1-raiz(1-2*m*k/fy))',sz:9,st:'normal'}]);
      subst(`k = ${f.Mu.toFixed(2)}*10^5/(0.90*${f.bEff}*${dcm.toFixed(1)}^2) = ${f.Rn.toFixed(2)} kg/cm2    m = ${mFy.toFixed(2)}`);
      subst(`rho = ${f.rhoReq.toFixed(7)}   vs   rho_min = ${rhoMin.toFixed(7)}   ->  rho diseno = ${f.rho.toFixed(7)}`);
      eqRow([{t:'s',v:'As = rho*b*d = '},{t:'s',v:f.AsReq.toFixed(2),st:'normal'},{t:'s',v:' cm2',st:'normal'}]);
      chipOK(rb.checks.asOk, ML+4, y+4, f.AsReq/rb.AsProv*100);
      txt(`As prov ${rb.AsProv.toFixed(2)} cm2 (${rb.n} ${getBarLabel(rb.db)} @ ${rb.s.toFixed(1)} cm)`, ML+42, y+4, 8.5,'normal',PAL.ink); y+=10;
      diagRec(!rb.checks.asOk, `Acero insuficiente en direccion ${dir}.`, 'Reduzca separacion o aumente diametro.');
      y+=2;
    });

    /* ---- 9 DISENO DE ACERO ---- */
    section(9, 'DISENO DE ACERO SUMINISTRADO');
    tableT(['Direccion','Diametro','Sep (cm)','Nro','As prov (cm2)','Gancho'], [30,22,22,15,36,40], [
      ['Inf X (par. B)', getBarLabel(I.dbX), I.sX, data.rebarX.n, data.rebarX.AsProv.toFixed(2), data.hooks.hookX?`${data.hooks.hookTypeX} grad`:'-'],
      ['Inf Y (par. L)', getBarLabel(I.dbY), I.sY, data.rebarY.n, data.rebarY.AsProv.toFixed(2), data.hooks.hookY?`${data.hooks.hookTypeY} grad`:'-'],
      ...(data.hasTop?[
        ['Sup X (par. B)', getBarLabel(data.dbTopX), data.sTopX, '-', '-', data.hooks.hookTopX?`${data.hooks.hookTypeTopX} grad`:'-'],
        ['Sup Y (par. L)', getBarLabel(data.dbTopY), data.sTopY, '-', '-', data.hooks.hookTopY?`${data.hooks.hookTypeTopY} grad`:'-']
      ]:[])
    ]);
    txt('Tabla de acero (despiece):', ML, y, 10, 'bold', PAL.navy); y+=6;
    tableT(['Marca','Descripcion','Cant','Long (cm)','Peso (kg)'], [20,70,18,28,29], data.steel.items.map(r=>[r.mark,r.desc,r.qty,r.length.toFixed(0),r.weight.toFixed(2)]));
    resLine('Peso total de acero', data.steel.total.toFixed(1), 'kg');

    /* ---- 10 DESARROLLO Y APLASTAMIENTO ---- */
    section(10, 'LONGITUDES DE DESARROLLO Y APLASTAMIENTO');
    eqRef('NSR-10 C.12 / E.12.2 - Eq. 12-2 (traccion)');
    eqRow([{t:'s',v:'ld = '},{t:'f',n:'fy',d:"3.51*lambda*raiz(f'c)"},{t:'s',v:' * '},{t:'f',n:'psi_t*psi_e*psi_s',d:'(cb+Ktr)/db'},{t:'s',v:' * db  >= 30 cm',st:'normal'}]);
    subst(`cb = ${dev.cb.toFixed(2)} cm ; (cb+Ktr)/db = ${dev.conf.toFixed(2)} (<=2.5) ; psi_t=${dev.psiT} psi_e=${dev.psiE} psi_s=${dev.psiS}`);
    subst(`ld = ${dev.ld.toFixed(1)} cm   ;   ldc (E.12.3) = ${devC.ldc.toFixed(1)} cm   ;   disponible = pedH+voladizo-rec = ${lvAv.toFixed(1)} cm`);
    chipOK(dev.ld<=lvAv, ML+4, y+4, dev.ld/lvAv*100); y+=10;
    diagRec(dev.ld>lvAv, 'Longitud de desarrollo de los dowels insuficiente.', 'Aumente pedH o use ganchos en el arranque.');
    eqRef('NSR-10 C.10.8 / E.10.8 - aplastamiento, phi = 0.65');
    eqRow([{t:'s',v:"phiPn = phi*0.85*f'c*A1 = "},{t:'s',v:(bear.phiPn/1000).toFixed(1),st:'normal'},{t:'s',v:' Ton',st:'normal'}]);
    chipOK(bear.ok, ML+4, y+4, bearUT); y+=8;

    /* ---- 11 RESUMEN EJECUTIVO ---- */
    section(11, 'RESUMEN EJECUTIVO');
    ensure(160);
    const cw2=(CW-6)/2;
    KPIS.forEach((kk,i)=>{
      const cxx = ML + (i%2)*(cw2+6);
      const cyy = y + Math.floor(i/2)*29;
      kpi(cxx, cyy, cw2, 26, kk[0], kk[1], kk[2], kk[3], kk[4], kk[5]);
    });
    y += Math.ceil(KPIS.length/2)*29 + 4;
    ensure(46);
    box(ML, y, CW, 20, PAL.light, PAL.navy, 0.4);
    txt('INDICE GLOBAL DE CUMPLIMIENTO', ML+5, y+7, 10, 'bold', PAL.navy);
    txt(`${nOK} / ${KPIS.length} verificaciones aprobadas   =   ${(nOK/KPIS.length*100).toFixed(0)} %`, ML+5, y+14, 12, 'bold', nOK===KPIS.length?PAL.green:PAL.red);
    y += 25;
    txt('Observaciones del revisor:', ML, y, 9.5, 'bold', PAL.navy); y+=5;
    const obs = [];
    if (pr.qmax>qa) obs.push('- Presion de servicio excede qa: redimensionar antes de detallar.');
    if (!kern.ok) obs.push('- Excentricidades fuera del nucleo: la hipotesis lineal no es valida.');
    if (!pu.ok) obs.push('- Punzonamiento gobierna el espesor.');
    if (!buls.ok) obs.push('- Verificacion ELU del suelo no satisfecha.');
    if (obs.length===0) obs.push('- Todas las verificaciones principales satisfacen la norma.');
    obs.forEach(o=>{ txt(o, ML+3, y, 8.5, 'normal', PAL.ink); y+=4.6; });
    y+=3;
    txt('Recomendaciones de rediseno:', ML, y, 9.5, 'bold', PAL.navy); y+=5;
    KPIS.filter(kk=>!kk[1]).forEach(kk=>{ txt('- '+kk[0]+': '+kk[7], ML+3, y, 8.5, 'normal', PAL.ink); y+=4.6; });
    if (KPIS.every(kk=>kk[1])) { txt('- No se requieren cambios; proceder con el detalle suministrado.', ML+3, y, 8.5,'normal',PAL.ink); y+=4.6; }

    /* ---- 12 CONCLUSIONES ---- */
    section(12, 'CONCLUSIONES');
    txt(data.allOk
      ? 'La zapata cumple la totalidad de las verificaciones ELS y ELU de la NSR-10 (Titulos B, C, E y H).'
      : 'La zapata NO cumple una o mas verificaciones; aplique las recomendaciones del resumen ejecutivo antes de emitir planos.',
      ML, y, 10, 'bold', data.allOk?PAL.green:PAL.red); y+=8;
    ['Geotecnia: presiones, capacidad, deslizamiento, volcamiento y asentamiento verificados.',
     'Estructura: punzonamiento, cortante unidireccional, flexion, desarrollo y aplastamiento verificados.',
     'El detalle de acero, ganchos y despiece corresponde al suministrado por el disenador.'].forEach(s=>{ txt('- '+s, ML+3, y, 9, 'normal', PAL.ink); y+=5.5; });
    y+=10;
    rule(ML+10, y+10, 45, PAL.ink, 0.4); rule(ML+CW-55, y+10, 45, PAL.ink, 0.4);
    txt('Elaboro: '+meta.elaboro, ML+32, y+16, 8.5, 'normal', PAL.ink, 'center');
    txt('Reviso: '+meta.reviso, ML+CW-32, y+16, 8.5, 'normal', PAL.ink, 'center');

    /* ---- ANEXO A: AUDITORIA NORMATIVA ---- */
    section('ANEXO A', 'AUDITORIA NORMATIVA DE ECUACIONES');
    tableT(['Ecuacion / criterio','Referencia NSR-10','Estado','Observacion'], [62,32,16,55], [
      ['q = P/A +/- Mx/Sx +/- My/Sy','C.15 / E.15 - H','OK','Sx/Sy y unidades kg/cm2 corregidos (v2)'],
      ['phi_v = 0.75 cortante','C.9 / E.9.4','OK','Antes 0.85 (error) corregido'],
      ["Vc = 0.53*raiz(f'c)*b*d",'C.11 / E.11.3','OK',''],
      ['bo, Vc menor de 3 expresiones','C.11.11 / E.11.11','OK','alpha_s=40, beta, lambda correctos'],
      ['Mu = qu*w*lv^2/2','C.15 / E.15.5','OK',''],
      ['rho = (1/m)(1-raiz(1-2mk/fy))','C.10 / E.10.3','OK','phi=0.90'],
      ['rho_min zapatas = 0.0018','C.10.5.4 / E.7.12','OK','Antes 14/fy (error) corregido'],
      ['ld Eq. 12-2, (cb+Ktr)/db <= 2.5','C.12 / E.12.2','OK','Antes fy/(55*raiz fc) (error) corregido'],
      ['ldc compresion','C.12.3 / E.12.3','OK',''],
      ["phiPn = 0.65*0.85*f'c*A1",'C.10.8 / E.10.8','OK',''],
      ['qult Meyerhof + FS','Titulo H / B.6','REV','Verificar FS >= 3 segun tipo de carga'],
      ['FS desliz = mu*SumV/SumH','Titulo H','REV','Sin empuje pasivo (conservador)'],
      ['Fe = SumMR/SumMO','Titulo H','REV','Sin aporte de suelo sobre zapata'],
      ['S = qnet/k','Titulo B / H','REV','Metodo elastico simplificado; unidades corregidas'],
      ['Distribucion lineal segun nucleo','C.15 / E.15','OK','ex<=L/6, ey<=B/6 implementado'],
      ['Ganchos y mandriles D=6db','C.7 / E.7.1-7.2','OK','Extensiones 12db / 4db'],
      ['Combinacion de cargas','C.9 / E.9.2','REV','Pu ingresado; validar combinacion gobernante'],
      ['As = rho*b*d','C.10 / E.10.3','OK','']
    ], 8);

    /* ---- ANEXO B: PLANOS ---- */
    section('ANEXO B', 'PLANOS Y MODELO');
    try {
      const pc=document.createElement('canvas'); pc.width=1100; pc.height=800; drawPlan(pc, data);
      doc.addImage(pc.toDataURL('image/png'),'PNG', ML, y, 78, 57);
      const sc2=document.createElement('canvas'); sc2.width=1100; sc2.height=800; drawSection(sc2, data);
      doc.addImage(sc2.toDataURL('image/png'),'PNG', ML+84, y, 81, 57);
      y+=60;
      if (typeof App!=='undefined' && App.snapshot3D){ const u=App.snapshot3D(); if(u){ ensure(66); doc.addImage(u,'PNG', ML+25, y, 115, 64); y+=66; } }
    } catch(e){ console.warn('Anexo B:', e); }

    /* ---- FOLIO ---- */
    const np=doc.getNumberOfPages();
    for(let p=1;p<=np;p++){
      doc.setPage(p);
      rule(ML, PH-MB+6, CW, PAL.line, 0.3);
      txt(`MC-${meta.id}-${String(p).padStart(2,'0')}`, ML, PH-MB+11, 7.5, 'normal', PAL.mut);
      txt(`Pagina ${p} de ${np}`, PW/2, PH-MB+11, 7.5, 'normal', PAL.mut, 'center');
      txt('FoundationPro NSR-10 - Memoria auditada v2', ML+CW, PH-MB+11, 7.5, 'normal', PAL.mut, 'right');
    }
    doc.save(`Memoria_AUDITADA_${meta.id}_${Date.now()}.pdf`);
    console.log('Memoria v2 generada');
  }

  /* ================= EXPORT DXF R12 COMPLETO ================= */
  function exportDXF(d) {
    if (!d || !d.input) { alert('Primero ejecute un calculo.'); return; }
    const I = d.input;
    const B = I.B||1.8, L = I.L||1.8, h = I.h||0.45;
    const colA = I.colA||30, colB = I.colB||30;
    const pedA = I.pedA||colA, pedB = I.pedB||colB, pedH = I.pedH||60;
    const sol = I.sol||5, rec = I.rec||7.5, Df = I.Df||1.5;
    const dbX = I.dbX||1.27, dbY = I.dbY||1.27;
    const hasTop = d.hasTop||false;
    const dbTopX = d.dbTopX||1.27, dbTopY = d.dbTopY||1.27;
    const hooks = d.hooks||{};
    const lay = d.layout||{x:{n:2,s:20},y:{n:2,s:20}};
    const meta = d.meta||{id:'Z1'};

    const M=1000, cm=10, TH=120;
    const mm = v => Math.round(v*100)/100;
    const out=[]; const g=(c,v)=>out.push(String(c),String(v));
    const barNum = db => ({'0.95':'3','1.27':'4','1.59':'5','1.91':'6','2.22':'7','2.54':'8','2.87':'9','3.23':'10'}[db.toFixed(2)]||db.toFixed(2));
    const mandrelRmm = db => ({'1.00':3.0,'1.27':3.6,'1.59':4.8,'1.91':6.0,'2.22':4.5,'2.54':5.0,'2.87':6.0,'3.23':6.0}[db.toFixed(2)]||3*db)*cm;

    const line=(la,x1,y1,x2,y2,lt)=>{g(0,'LINE');g(8,la);if(lt)g(6,lt);g(10,mm(x1));g(20,mm(y1));g(11,mm(x2));g(21,mm(y2));};
    const poly=(la,pts,closed,lt)=>{g(0,'POLYLINE');g(8,la);if(lt)g(6,lt);g(66,1);g(70,closed?1:0);pts.forEach(p=>{g(0,'VERTEX');g(8,la);g(10,mm(p[0]));g(20,mm(p[1]));});g(0,'SEQEND');g(8,la);};
    const rect=(la,x,y,w,hh,lt)=>poly(la,[[x,y],[x+w,y],[x+w,y+hh],[x,y+hh]],true,lt);
    const circle=(la,x,y,r)=>{g(0,'CIRCLE');g(8,la);g(10,mm(x));g(20,mm(y));g(40,mm(r));};
    const text=(la,x,y,hgt,str,rot)=>{g(0,'TEXT');g(8,la);g(10,mm(x));g(20,mm(y));g(40,mm(hgt));g(1,str);if(rot)g(50,rot);};
    const slash=(la,x,y)=>line(la,x-70,y-70,x+70,y+70);
    const dimH=(la,x1,x2,y,label)=>{line(la,x1,y,x2,y);slash(la,x1,y);slash(la,x2,y);text(la,(x1+x2)/2-label.length*TH*0.3,y+TH*0.8,TH,label);};
    const dimV=(la,y1,y2,x,label)=>{line(la,x,y1,x,y2);slash(la,x,y1);slash(la,x,y2);text(la,x+TH*0.8,(y1+y2)/2-label.length*TH*0.3,TH,label,90);};
    const chainH=(la,y,xs,label)=>{ if(xs.length<2)return; line(la,xs[0],y,xs[xs.length-1],y); xs.forEach(x=>slash(la,x,y)); text(la,(xs[0]+xs[xs.length-1])/2-label.length*TH*0.3,y-TH*1.1,TH,label); };
    const chainV=(la,x,ys,label)=>{ if(ys.length<2)return; line(la,x,ys[0],x,ys[ys.length-1]); ys.forEach(yy=>slash(la,x,yy)); text(la,x-TH*2.2,(ys[0]+ys[ys.length-1])/2-label.length*TH*0.3,TH,label,90); };
    const arcPts=(cx,cy,r,a0,a1,seg)=>{const p=[];for(let i=1;i<seg;i++){const a=(a0+(a1-a0)*i/seg)*Math.PI/180;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return p;};
    const arrow=(la,x,y,ux,uy)=>{const px=-uy,py=ux;line(la,x,y,x-ux*250+px*80,y-uy*250+py*80);line(la,x,y,x-ux*250-px*80,y-uy*250-py*80);};

    g(0,'SECTION');g(2,'HEADER');
    g(9,'$ACADVER');g(1,'AC1009');
    g(9,'$EXTMIN');g(10,-30000);g(20,-30000);g(30,0);
    g(9,'$EXTMAX');g(10,40000);g(20,30000);g(30,0);
    g(0,'ENDSEC');

    g(0,'SECTION');g(2,'TABLES');
    g(0,'TABLE');g(2,'LTYPE');g(70,2);
    g(0,'LTYPE');g(2,'DASHDOT');g(70,0);g(3,'Dash dot');g(72,65);g(73,4);g(40,20);g(49,12);g(49,-4);g(49,0);g(49,-4);
    g(0,'LTYPE');g(2,'DASHED');g(70,0);g(3,'Dashed');g(72,65);g(73,2);g(40,16);g(49,10);g(49,-6);
    g(0,'ENDTAB');
    const LAYERS=[['ZAPATA',5],['SOLADO',8],['PEDESTAL',4],['COLUMNA',1],['ACERO_INF_X',3],['ACERO_INF_Y',3],['ACERO_SUP_X',6],['ACERO_SUP_Y',6],['TERRENO',8],['COTAS',2],['TEXTO',7],['EJES',1],['SECCIONES',6]];
    g(0,'TABLE');g(2,'LAYER');g(70,LAYERS.length);
    LAYERS.forEach(([n,c])=>{g(0,'LAYER');g(2,n);g(70,0);g(62,c);g(6,'CONTINUOUS');});
    g(0,'ENDTAB');
    g(0,'ENDSEC');

    g(0,'SECTION');g(2,'ENTITIES');
    text('TEXTO', -B*M/2, L*M/2 + 6500, TH*1.6, `ZAPATA ${meta.id} - PLANTA Y CORTES (unidades: mm)`);

    // PLANTA
    const px0=-B*M/2, py0=-L*M/2;
    rect('SOLADO', px0-50, py0-50, B*M+100, L*M+100, 'DASHED');
    rect('ZAPATA', px0, py0, B*M, L*M);
    rect('PEDESTAL', -pedA*cm/2, -pedB*cm/2, pedA*cm, pedB*cm);
    rect('COLUMNA', -colA*cm/2, -colB*cm/2, colA*cm, colB*cm);
    line('EJES', px0-1500, 0, px0+B*M+1500, 0, 'DASHDOT');
    line('EJES', 0, py0-1500, 0, py0+L*M+1500, 'DASHDOT');
    circle('EJES', px0-1500, 0, 300); text('EJES', px0-1560, -100, TH, 'A');
    circle('EJES', 0, py0+L*M+1500, 300); text('EJES', -60, py0+L*M+1400, TH, '1');
    line('SECCIONES', px0-800, 0, px0+B*M+800, 0);
    arrow('SECCIONES', px0-800, 0, 0, 1); arrow('SECCIONES', px0+B*M+800, 0, 0, 1);
    text('SECCIONES', px0-1150, 350, TH*1.2, 'A'); text('SECCIONES', px0+B*M+900, 350, TH*1.2, 'A');
    line('SECCIONES', 0, py0-800, 0, py0+L*M+800);
    arrow('SECCIONES', 0, py0-800, 1, 0); arrow('SECCIONES', 0, py0+L*M+800, 1, 0);
    text('SECCIONES', 350, py0-950, TH*1.2, 'B'); text('SECCIONES', 350, py0+L*M+950, TH*1.2, 'B');

    const cx0=px0+rec*cm, cx1=px0+B*M-rec*cm, cy0=py0+rec*cm, cy1=py0+L*M-rec*cm;
    const ysX=[], xsY=[];
    for(let i=0;i<lay.y.n;i++){const yy=cy0+i*lay.y.s*cm; if(yy>cy1+1)break; ysX.push(yy); line('ACERO_INF_X',cx0,yy,cx1,yy);}
    for(let i=0;i<lay.x.n;i++){const xx=cx0+i*lay.x.s*cm; if(xx>cx1+1)break; xsY.push(xx); line('ACERO_INF_Y',xx,cy0,xx,cy1);}
    if(hasTop){
      for(let i=0;i<lay.y.n;i++){const yy=cy0+i*(d.sTopX||25)*cm; if(yy>cy1+1)break; line('ACERO_SUP_X',cx0+30,yy,cx1-30,yy);}
      for(let i=0;i<lay.x.n;i++){const xx=cx0+i*(d.sTopY||25)*cm; if(xx>cx1+1)break; line('ACERO_SUP_Y',xx,cy0+30,xx,cy1-30);}
    }
    chainV('COTAS', px0-700, ysX, `${ysX.length} #${barNum(dbX)} @ ${I.sX||20} cm`);
    chainH('COTAS', py0-700, xsY, `${xsY.length} #${barNum(dbY)} @ ${I.sY||20} cm`);
    dimH('COTAS', px0, px0+B*M, py0-1700, `B = ${B.toFixed(2)} m`);
    dimV('COTAS', py0, py0+L*M, px0-1700, `L = ${L.toFixed(2)} m`);
    line('COTAS', cx0, cy0, cx0-500, cy0-500);
    text('TEXTO', cx0-2600, cy0-750, TH, `REC = ${rec} cm`);
    text('TEXTO', px0, py0-TH*4.5, TH*1.4, 'PLANTA DE ZAPATA');
    text('TEXTO', cx1+TH*1.2, cy0, TH, `INF X: ${lay.y.n} #${barNum(dbX)} @ ${I.sX||20}`, 90);
    text('TEXTO', cx1+TH*2.6, cy0, TH, `INF Y: ${lay.x.n} #${barNum(dbY)} @ ${I.sY||20}`, 90);
    if(hasTop){
      text('TEXTO', cx1+TH*4.0, cy0, TH, `SUP X: #${barNum(dbTopX)} @ ${d.sTopX||25}`, 90);
      text('TEXTO', cx1+TH*5.4, cy0, TH, `SUP Y: #${barNum(dbTopY)} @ ${d.sTopY||25}`, 90);
    }
    text('TEXTO', px0, py0-TH*6.8, TH, `NOTAS: f'c=${I.fc} kg/cm2  fy=${I.fy} kg/cm2  REC=${rec} cm  d=${d.d.toFixed(1)} cm`);

    // CORTES
    function drawSectionDXF(originX, width, isDirX, title){
      const w=width*M, x0=originX, x1=originX+w;
      const baseY=-L*M/2-6500;
      const yTopF=baseY+h*M;
      const grade=baseY+Df*M;
      const pcx=(x0+x1)/2;
      line('TERRENO', x0-600, grade, x1+600, grade);
      for(let xx=x0-600; xx<x1+600; xx+=350) line('TERRENO', xx, grade, xx-120, grade-120);
      text('TERRENO', x1+700, grade-40, TH, `NPT -${Df.toFixed(2)} m`);
      rect('SOLADO', x0-50, baseY-sol*cm, w+100, sol*cm, 'DASHED');
      text('SOLADO', x0-50, baseY-sol*cm-TH*1.2, TH*0.9, `SOLADO ${sol} cm`);
      rect('ZAPATA', x0, baseY, w, h*M);
      const pw=(isDirX?pedA:pedB)*cm, cw2=(isDirX?colA:colB)*cm;
      rect('PEDESTAL', pcx-pw/2, yTopF, pw, pedH*cm);
      rect('COLUMNA', pcx-cw2/2, yTopF+pedH*cm, cw2, 1500);
      line('EJES', pcx, baseY-800, pcx, yTopF+pedH*cm+2200, 'DASHDOT');
      text('TEXTO', x0, yTopF+pedH*cm+2500, TH*1.2, title);

      const db=isDirX?dbX:dbY, laI=isDirX?'ACERO_INF_X':'ACERO_INF_Y';
      const yb=baseY+rec*cm+db*cm/2, xs=x0+rec*cm, xe=x1-rec*cm;
      const hook=isDirX?hooks.hookX:hooks.hookY, htype=isDirX?(hooks.hookTypeX||90):(hooks.hookTypeY||90);
      let pts;
      if(hook&&htype===180){const R=mandrelRmm(db),tail=Math.max(4*db,7)*cm;
        pts=[[xs+tail,yb+2*R],[xs,yb+2*R]].concat(arcPts(xs,yb+R,R,90,270,8)).concat([[xs,yb],[xe,yb]]).concat(arcPts(xe,yb+R,R,-90,90,8)).concat([[xe,yb+2*R],[xe-tail,yb+2*R]]);
      } else if(hook){const hl=Math.max(12*db,15)*cm; pts=[[xs,yb+hl],[xs,yb],[xe,yb],[xe,yb+hl]];
      } else pts=[[xs,yb],[xe,yb]];
      poly(laI,pts,false);

      if(hasTop){
        const dbT=isDirX?dbTopX:dbTopY, laS=isDirX?'ACERO_SUP_X':'ACERO_SUP_Y';
        const yt=yTopF-rec*cm-dbT*cm/2;
        const hookT=isDirX?hooks.hookTopX:hooks.hookTopY, htypeT=isDirX?(hooks.hookTypeTopX||90):(hooks.hookTypeTopY||90);
        let ptsT;
        if(hookT&&htypeT===180){const R=mandrelRmm(dbT),tail=Math.max(4*dbT,7)*cm;
          ptsT=[[xs+tail,yt-2*R],[xs,yt-2*R]].concat(arcPts(xs,yt-R,R,270,90,8)).concat([[xs,yt],[xe,yt]]).concat(arcPts(xe,yt-R,R,90,-90,8)).concat([[xe,yt-2*R],[xe-tail,yt-2*R]]);
        } else if(hookT){const hl=Math.max(12*dbT,15)*cm; ptsT=[[xs,yt-hl],[xs,yt],[xe,yt],[xe,yt-hl]];
        } else ptsT=[[xs,yt],[xe,yt]];
        poly(laS,ptsT,false);
        line('COTAS', xs+300, yt, x0-400, yt+600);
        text('TEXTO', x0-3400, yt+700, TH, `SUP #${barNum(dbT)} @ ${(isDirX?d.sTopX:d.sTopY)||25}`);
      }
      line('COTAS', xs+300, yb, x0-400, yb-600);
      text('TEXTO', x0-3400, yb-800, TH, `INF #${barNum(db)} @ ${(isDirX?I.sX:I.sY)||20}`);

      dimV('COTAS', baseY, yTopF, x1+TH*3, `h = ${(h*100).toFixed(0)} cm`);
      dimV('COTAS', yTopF, yTopF+pedH*cm, x1+TH*6, `ped = ${pedH} cm`);
      dimV('COTAS', baseY, grade, x0-TH*5, `Df = ${Df.toFixed(2)} m`);
      dimH('COTAS', x0, x1, baseY-TH*3, `${width.toFixed(2)} m`);
      dimH('COTAS', pcx-pw/2, pcx+pw/2, yTopF+pedH*cm+TH*1.2, `${(isDirX?pedA:pedB)} cm`);
      line('COTAS', xs, yb, xs-300, yb-500);
      text('TEXTO', xs-2400, yb-700, TH*0.9, `REC ${rec}`);
    }

    const offA=B*M/2+4500;
    drawSectionDXF(offA, B, true, 'CORTE A-A');
    drawSectionDXF(offA+B*M+4500, L, false, 'CORTE B-B');

    g(0,'ENDSEC'); g(0,'EOF');

    const blob=new Blob([out.join('\n')],{type:'application/dxf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`Zapata_${meta.id}_${Date.now()}.dxf`;
    a.click(); URL.revokeObjectURL(url);
  }

  return { drawPlan, drawSection, plotPressures, generatePDF, exportDXF };
})();