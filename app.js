/**
 * APP.JS — FoundationPro NSR-10
 * Textos 3D escalables · Qux/Quy · sin estribos · botón Redibujar · flechas de cargas
 */
const App = (() => {

  let scene, camera, renderer, controls;
  let foundationGroup, pressureMesh, loadsGroup;
  let currentData = null;
  let labelScale = 0.42;

  const MANDREL_D = { '1.00':6.00,'1.27':7.20,'1.59':9.60,'1.91':12.00,'2.22':9.00,'2.54':10.00,'2.87':12.00,'3.23':12.00 };

  function init() {
    try {
      if (typeof THREE === 'undefined') throw new Error('Three.js no cargó.');
      if (typeof Geometry === 'undefined') throw new Error('geometry.js no cargó.');
      if (typeof Geotechnical === 'undefined') throw new Error('geotechnical.js no cargó.');
      if (typeof Design === 'undefined') throw new Error('design.js no cargó.');
      if (typeof Reinforcement === 'undefined') throw new Error('reinforcement.js no cargó.');
      if (typeof Foundation === 'undefined') throw new Error('foundation.js no cargó.');
      if (typeof Report === 'undefined') throw new Error('report.js no cargó.');
      initThree(); bindUI(); compute();
      window.addEventListener('resize', onResize);
      const banner = document.getElementById('load-banner');
      if (banner) banner.style.display = 'none';
      console.log('✅ FoundationPro inicializado correctamente');
    } catch (err) {
      console.error('❌ Error de inicialización:', err);
      const banner = document.getElementById('load-banner');
      if (banner) { banner.style.background = '#7f1d1d'; banner.style.color = '#fecaca'; banner.textContent = '❌ Error: ' + err.message; }
    }
  }

  function initThree() {
    const container = document.getElementById('three-container');
    if (!container) throw new Error('No se encontró #three-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 10, 30);
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(4, 3, 5);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.1;
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(5, 10, 7); dir.castShadow = true; scene.add(dir);
    const grid = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b); grid.name = 'grid'; scene.add(grid);
    const terrainMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x78502a, transparent: true, opacity: 0.5 }));
    terrainMesh.rotation.x = -Math.PI / 2; terrainMesh.position.y = -0.01; scene.add(terrainMesh);
    foundationGroup = new THREE.Group(); scene.add(foundationGroup);
    animate();
  }

  function animate() { requestAnimationFrame(animate); if (controls) controls.update(); if (renderer && scene && camera) renderer.render(scene, camera); }
  function onResize() { const c = document.getElementById('three-container'); if (!c) return; camera.aspect = c.clientWidth / c.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(c.clientWidth, c.clientHeight); }

  function bindUI() {
    const chkTop = document.getElementById('chk-top-rebar');
    if (chkTop) chkTop.addEventListener('change', e => { const s = document.getElementById('top-rebar-section'); if (s) s.style.display = e.target.checked ? 'block' : 'none'; compute(); });
    ['chk-hook-x','chk-hook-y','chk-hook-top-x','chk-hook-top-y'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', e => {
        const dir = id.includes('top') ? (id.includes('-x') ? 'top-x' : 'top-y') : (id.includes('-x') ? 'x' : 'y');
        const op = document.getElementById(`hook-${dir}-options`);
        if (op) op.style.display = e.target.checked ? 'block' : 'none';
        compute();
      });
    });
    document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', compute));
    const b = id => document.getElementById(id);
    if (b('btn-calc')) b('btn-calc').addEventListener('click', compute);
    if (b('btn-optimize')) b('btn-optimize').addEventListener('click', doOptimize);
    if (b('btn-pdf')) b('btn-pdf').addEventListener('click', () => Report.generatePDF(currentData));
    if (b('btn-dxf')) b('btn-dxf').addEventListener('click', () => Report.exportDXF(currentData));
    if (b('btn-plans')) b('btn-plans').addEventListener('click', () => switchTab('plan'));
    if (b('btn-redraw')) b('btn-redraw').addEventListener('click', redrawViews);
    const rng = b('rng-labels');
    if (rng) rng.addEventListener('input', e => { labelScale = parseFloat(e.target.value) || 0.42; if (currentData) build3D(currentData); });
    document.querySelectorAll('.tab-btn').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    document.querySelectorAll('.view-btn').forEach(v => v.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(x => x.classList.remove('active'));
      v.classList.add('active'); setView(v.dataset.view);
    }));
    ['chk-press','chk-rebar','chk-grid','chk-loads'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', updateVisibility); });
  }

  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.view-panel').forEach(p => { p.style.display = (p.id === `view-${tab}`) ? 'block' : 'none'; });
    redrawActiveTab(tab);
  }

  function redrawActiveTab(tab) {
    if (tab === 'plan') Report.drawPlan(document.getElementById('canvas-plan'), currentData);
    if (tab === 'section') Report.drawSection(document.getElementById('canvas-section'), currentData);
    if (tab === 'press') Report.plotPressures('plot-press', currentData);
  }

  function redrawViews() {
    compute();
    const active = document.querySelector('.tab-btn.active');
    redrawActiveTab(active ? active.dataset.tab : '3d');
  }

  function setView(v) {
    const d = 5;
    if (v === 'iso') camera.position.set(4, 3, 5);
    if (v === 'top') camera.position.set(0, d, 0.01);
    if (v === 'front') camera.position.set(0, 1, d);
    if (v === 'side') camera.position.set(d, 1, 0);
    controls.target.set(0, 0.3, 0); controls.update();
  }

  function updateVisibility() {
    const grid = scene.getObjectByName('grid');
    if (grid) grid.visible = document.getElementById('chk-grid').checked;
    if (pressureMesh) pressureMesh.visible = document.getElementById('chk-press').checked;
    const cr = document.getElementById('chk-rebar');
    foundationGroup.children.filter(c => c.userData.isRebar).forEach(r => r.visible = cr ? cr.checked : true);
    const cl = document.getElementById('chk-loads');
    if (loadsGroup) loadsGroup.visible = cl ? cl.checked : true;
  }

  function readInput() {
    const num = (id, def = 0) => { const e = document.getElementById(id); const v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : def; };
    const chk = id => { const e = document.getElementById(id); return e ? !!e.checked : false; };
    const int = (id, def = 90) => { const e = document.getElementById(id); const v = e ? parseInt(e.value, 10) : NaN; return isFinite(v) ? v : def; };
    return {
      B: num('in-B',1.8), L: num('in-L',1.8), h: num('in-h',0.45), rec: num('in-rec',7.5),
      colA: num('in-col-a',30), colB: num('in-col-b',30),
      pedA: num('in-pedA',0) || num('in-col-a',30), pedB: num('in-pedB',0) || num('in-col-b',30),
      pedH: num('in-ped-h',60), sol: num('in-sol',5),
      fc: num('in-fc',210), fy: num('in-fy',4200), gc: num('in-gc',2400),
      qa: num('in-qa',1.5), gs: num('in-gs',1800), NF: num('in-nf',5), k: num('in-k',2),
      delta: num('in-delta',2.5), Df: num('in-df',1.5), cp: num('in-cp',0.1), phi: num('in-phi',28),
      P: num('in-P',40), Mx: num('in-Mx',3), My: num('in-My',2), Hx: num('in-Hx',1), Hy: num('in-Hy',0.5),
      Pu: num('in-Pu',58), Mux: num('in-Mux',4.5), Muy: num('in-Muy',3), Hux: num('in-Hux',1.5), Huy: num('in-Huy',0.8),
      dbX: num('in-db-x',1.27), dbY: num('in-db-y',1.27), sX: num('in-s-x',20), sY: num('in-s-y',20),
      hasTop: chk('chk-top-rebar'), dbTopX: num('in-db-top-x',1.27), dbTopY: num('in-db-top-y',1.27),
      sTopX: num('in-s-top-x',25), sTopY: num('in-s-top-y',25),
      hookX: chk('chk-hook-x'), hookTypeX: int('in-hook-x'), hookY: chk('chk-hook-y'), hookTypeY: int('in-hook-y'),
      hookTopX: chk('chk-hook-top-x'), hookTypeTopX: int('in-hook-top-x'), hookTopY: chk('chk-hook-top-y'), hookTypeTopY: int('in-hook-top-y'),
      dbCol: num('in-db-col',1.91), nCol: num('in-n-col',8)
    };
  }

  function readMeta() {
    const txt = (id, def) => { const e = document.getElementById(id); return (e && e.value) ? e.value : def; };
    return { project: txt('in-proj','Proyecto Estructural'), id: txt('in-zid','Z1'), date: txt('in-date', new Date().toISOString().slice(0,10)), elaboro: txt('in-elab','Ing. Calculista'), reviso: txt('in-rev','Ing. Revisor') };
  }

  function compute() {
    try {
      const input = readInput();
      const beta = document.getElementById('in-beta1');
      if (beta) beta.value = Geometry.beta1(input.fc).toFixed(3);
      currentData = Foundation.analyze(input);
      currentData.meta = readMeta();
      renderResults(currentData);
      build3D(currentData);
    } catch (err) {
      console.error('Error en compute:', err);
      const gs = document.getElementById('global-status');
      if (gs) { gs.textContent = '❌ Error: ' + err.message; gs.className = 'status-box fail'; }
    }
  }

  function doOptimize() {
    try {
      if (typeof Foundation.optimize !== 'function') { alert('Optimización no disponible.'); return; }
      const opt = Foundation.optimize(readInput());
      if (!opt) { alert('No se encontró solución óptima en el rango.'); return; }
      document.getElementById('in-B').value = opt.B.toFixed(2);
      document.getElementById('in-L').value = opt.L.toFixed(2);
      document.getElementById('in-h').value = opt.h.toFixed(2);
      compute();
      alert(`✅ Optimizado: B=${opt.B} m, L=${opt.L} m, h=${opt.h} m`);
    } catch (err) { alert('Error en optimización: ' + err.message); }
  }

  function renderResults(d) {
    if (!d) return;
    const gs = document.getElementById('global-status');
    if (gs) { gs.className = 'status-box ' + (d.allOk ? 'ok' : 'fail'); gs.textContent = d.allOk ? '✅ DISEÑO CUMPLE' : '❌ NO CUMPLE'; }

    const geo = document.getElementById('geo-results');
    if (geo) {
      geo.innerHTML = '';
      if (d.geoCheck) d.geoCheck.forEach(r => geo.appendChild(resultRow(r.name, `${r.demand.toFixed(3)} / ${r.capacity.toFixed(3)}`, r.ok)));
      if (d.kern) {
        geo.appendChild(resultRow('ex ≤ L/6', `${d.kern.ex.toFixed(3)} ≤ ${d.kern.exLim.toFixed(3)}`, d.kern.ex <= d.kern.exLim));
        geo.appendChild(resultRow('ey ≤ B/6', `${d.kern.ey.toFixed(3)} ≤ ${d.kern.eyLim.toFixed(3)}`, d.kern.ey <= d.kern.eyLim));
      }
      if (d.bc) geo.appendChild(resultRow('Cap. portante qadm', `${d.bc.qadm.toFixed(2)} kg/cm²`, d.press.qmax <= d.bc.qadm));
      if (d.bearingULS) geo.appendChild(resultRow('qmax_u ≤ qult (ELU)', `${d.bearingULS.demand.toFixed(3)} / ${d.bearingULS.capacity.toFixed(2)}`, d.bearingULS.ok));
      if (d.sliding) geo.appendChild(resultRow('FS deslizamiento', d.sliding.FS.toFixed(2), d.sliding.ok));
      if (d.overturn) geo.appendChild(resultRow('Fe volcamiento', d.overturn.Fe_x.toFixed(2), d.overturn.Fe_x >= 1.5));
      if (d.settle !== undefined) geo.appendChild(resultRow('Asentamiento', `${d.settle.toFixed(2)} cm`, d.settle <= d.input.delta));
    }

    const pu = document.getElementById('punch-results');
    if (pu) { pu.innerHTML = ''; if (d.punch) { pu.appendChild(resultRow('b0', `${d.punch.b0.toFixed(1)} cm`, true)); pu.appendChild(resultRow('Vu', `${(d.punch.Vu/1000).toFixed(2)} Ton`, true)); pu.appendChild(resultRow('φVc', `${(d.punch.phiVc/1000).toFixed(2)} Ton`, true)); pu.appendChild(resultRow('Vu/φVc', d.punch.ratio.toFixed(2), d.punch.ok)); } }

    const sh = document.getElementById('shear-results');
    if (sh) { sh.innerHTML = ''; if (d.shearX) sh.appendChild(resultRow('Vu/φVc X', d.shearX.ratio.toFixed(2), d.shearX.ok)); if (d.shearY) sh.appendChild(resultRow('Vu/φVc Y', d.shearY.ratio.toFixed(2), d.shearY.ok)); }

    const fl = document.getElementById('flex-results');
    if (fl) {
      fl.innerHTML = '';
      if (d.flexX) { fl.appendChild(resultRow('Mu X (vuelo en B)', `${d.flexX.Mu.toFixed(2)} Ton·m`, true)); fl.appendChild(resultRow('As req X (ρmin 0.0018)', `${d.flexX.AsReq.toFixed(2)} cm²`, true)); fl.appendChild(resultRow('As min X', `${d.flexX.AsMin.toFixed(2)} cm²`, true)); }
      if (d.flexY) { fl.appendChild(resultRow('Mu Y (vuelo en L)', `${d.flexY.Mu.toFixed(2)} Ton·m`, true)); fl.appendChild(resultRow('As req Y (ρmin 0.0018)', `${d.flexY.AsReq.toFixed(2)} cm²`, true)); fl.appendChild(resultRow('As min Y', `${d.flexY.AsMin.toFixed(2)} cm²`, true)); }
    }

    const rb = document.getElementById('rebar-results');
    if (rb) {
      rb.innerHTML = '';
      const hl = (db, t) => (typeof Reinforcement !== 'undefined' && Reinforcement.getHookLength) ? Reinforcement.getHookLength(db, t) : 0;
      if (d.rebarX) {
        rb.appendChild(createSubTitle('📐 Inferior Dir. X — barras ∥ B:'));
        rb.appendChild(resultRow('Ø / sep.', `${Geometry.barName(d.rebarX.db)} @ ${d.rebarX.s.toFixed(1)} cm`, d.rebarX.checks.sMaxOk));
        rb.appendChild(resultRow('N° barras (en L)', d.rebarX.n, true));
        rb.appendChild(resultRow('As req (flex. vuelo B)', `${d.flexX.AsReq.toFixed(2)} cm²`, true));
        rb.appendChild(resultRow('As prov', `${d.rebarX.AsProv.toFixed(2)} cm²`, d.rebarX.checks.asOk));
        if (d.hooks && d.hooks.hookX) rb.appendChild(resultRow('Gancho', `${d.hooks.hookTypeX}° (${hl(d.rebarX.db, d.hooks.hookTypeX)} cm)`, true));
      }
      if (d.rebarY) {
        rb.appendChild(createSubTitle('📐 Inferior Dir. Y — barras ∥ L:'));
        rb.appendChild(resultRow('Ø / sep.', `${Geometry.barName(d.rebarY.db)} @ ${d.rebarY.s.toFixed(1)} cm`, d.rebarY.checks.sMaxOk));
        rb.appendChild(resultRow('N° barras (en B)', d.rebarY.n, true));
        rb.appendChild(resultRow('As req (flex. vuelo L)', `${d.flexY.AsReq.toFixed(2)} cm²`, true));
        rb.appendChild(resultRow('As prov', `${d.rebarY.AsProv.toFixed(2)} cm²`, d.rebarY.checks.asOk));
        if (d.hooks && d.hooks.hookY) rb.appendChild(resultRow('Gancho', `${d.hooks.hookTypeY}° (${hl(d.rebarY.db, d.hooks.hookTypeY)} cm)`, true));
      }
      if (d.hasTop) {
        const tX = d.dbTopX || 1.27, tY = d.dbTopY || 1.27;
        rb.appendChild(createSubTitle('🔝 Superior Dir. X — barras ∥ B:'));
        rb.appendChild(resultRow('Ø / sep.', `${Geometry.barName(tX)} @ ${d.sTopX || 25} cm`, true));
        if (d.hooks && d.hooks.hookTopX) rb.appendChild(resultRow('Gancho', `${d.hooks.hookTypeTopX}° (${hl(tX, d.hooks.hookTypeTopX)} cm)`, true));
        rb.appendChild(createSubTitle('🔝 Superior Dir. Y — barras ∥ L:'));
        rb.appendChild(resultRow('Ø / sep.', `${Geometry.barName(tY)} @ ${d.sTopY || 25} cm`, true));
        if (d.hooks && d.hooks.hookTopY) rb.appendChild(resultRow('Gancho', `${d.hooks.hookTypeTopY}° (${hl(tY, d.hooks.hookTypeTopY)} cm)`, true));
      }
      rb.appendChild(createSubTitle('🏛️ Columna:'));
      rb.appendChild(resultRow('Ø barras col.', Geometry.barName(d.dbCol || 1.91), true));
      rb.appendChild(resultRow('N° barras col.', d.nCol || 8, true));
    }

    const dv = document.getElementById('dev-results');
    if (dv) {
      dv.innerHTML = '';
      dv.appendChild(createSubTitle('📏 Desarrollo E.12.2 (tracción):'));
      dv.appendChild(resultRow('cb', `${d.dev.cb.toFixed(2)} cm`, true));
      dv.appendChild(resultRow('(cb+Ktr)/db ≤ 2.5', d.dev.conf.toFixed(2), true));
      dv.appendChild(resultRow('ψs / ψt', `${d.dev.psiS.toFixed(1)} / ${d.dev.psiT.toFixed(1)}`, true));
      dv.appendChild(resultRow('ld requerida', `${d.dev.ld.toFixed(1)} cm`, true));
      dv.appendChild(resultRow('ld compresión E.12.3', `${d.devC.ldc.toFixed(1)} cm`, true));
      dv.appendChild(createSubTitle('📐 Disponible zapata+pedestal:'));
      dv.appendChild(resultRow('pedH (pedestal)', `${d.input.pedH.toFixed(0)} cm`, true));
      dv.appendChild(resultRow('Voladizo', `${(d.voladizo || 0).toFixed(1)} cm`, true));
      dv.appendChild(resultRow('ld disponible', `${d.lvAvail.toFixed(1)} cm`, d.dev.ld <= d.lvAvail));
      dv.appendChild(resultRow('φPn aplast.', `${(d.bear.phiPn/1000).toFixed(1)} Ton`, d.bear.ok));
    }

    const st = document.getElementById('steel-table');
    if (st && d.steel) {
      let html = '<table class="steel-table"><thead><tr><th>Marca</th><th>Desc</th><th>Cant</th><th>L(cm)</th><th>Peso(kg)</th></tr></thead><tbody>';
      d.steel.items.forEach(i => { html += `<tr><td>${i.mark}</td><td>${i.desc}</td><td>${i.qty}</td><td>${i.length.toFixed(0)}</td><td>${i.weight.toFixed(1)}</td></tr>`; });
      html += `</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:bold">TOTAL</td><td style="font-weight:bold">${d.steel.total.toFixed(1)}</td></tr></tfoot></table>`;
      st.innerHTML = html;
    }

    const al = document.getElementById('alerts');
    if (al) {
      al.innerHTML = '';
      if (d.kern && !d.kern.ok) al.appendChild(alertItem('Excentricidad fuera del núcleo: la distribución lineal de presiones no es válida (hay descompresión parcial).', 'error'));
      if (d.bearingULS && !d.bearingULS.ok) al.appendChild(alertItem(`ELU suelo: qmax_u = ${d.bearingULS.demand.toFixed(2)} > qult = ${d.bearingULS.capacity.toFixed(2)} kg/cm². Aumente B, L o Df.`, 'error'));
      if (d.geoCheck && !d.geoCheck[0].ok) al.appendChild(alertItem('qmax > qa. Aumente B o L.', 'error'));
      if (d.geoCheck && !d.geoCheck[1].ok) al.appendChild(alertItem('qmin < 0. Zapata con despegue.', 'error'));
      if (d.punch && !d.punch.ok) al.appendChild(alertItem('Falla por punzonamiento. Aumente h.', 'error'));
      if (d.shearX && !d.shearX.ok) al.appendChild(alertItem('Falla cortante unidireccional X.', 'error'));
      if (d.shearY && !d.shearY.ok) al.appendChild(alertItem('Falla cortante unidireccional Y.', 'error'));
      if (d.rebarX && !d.rebarX.ok) al.appendChild(alertItem(`Refuerzo X insuficiente: As prov ${d.rebarX.AsProv.toFixed(2)} < As req ${d.flexX.AsReq.toFixed(2)} cm²`, 'error'));
      if (d.rebarY && !d.rebarY.ok) al.appendChild(alertItem(`Refuerzo Y insuficiente: As prov ${d.rebarY.AsProv.toFixed(2)} < As req ${d.flexY.AsReq.toFixed(2)} cm²`, 'error'));
      if (d.bear && !d.bear.ok) al.appendChild(alertItem('Falla por aplastamiento.', 'error'));
      if (d.dev && d.dev.ld > d.lvAvail) al.appendChild(alertItem(`Longitud de desarrollo insuficiente para Ø${d.dbCol} cm.`, 'error'));
      if (al.innerHTML === '') al.appendChild(alertItem('Sin observaciones. ✅', 'info'));
    }

    const info3d = document.getElementById('info-3d');
    if (info3d) info3d.textContent = `B=${d.input.B}m · L=${d.input.L}m · h=${d.input.h}m · d=${d.d.toFixed(1)}cm`;
  }

  function createSubTitle(t) { const div = document.createElement('div'); div.style.cssText = 'font-size:10px;font-weight:bold;color:#60a5fa;margin-top:8px;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;'; div.textContent = t; return div; }
  function resultRow(label, value, ok) { const div = document.createElement('div'); div.className = 'result-row ' + (ok ? 'ok' : 'fail'); div.innerHTML = `<span class="label">${label}</span><span class="value">${ok ? '✅' : '❌'} ${value}</span>`; return div; }
  function alertItem(msg, type = 'warn') { const div = document.createElement('div'); div.className = 'alert-item ' + type; div.textContent = msg; return div; }

  function makeLabel(text, colorHex, scale) {
    const s = scale || labelScale;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = 'bold 44px Arial';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 24;
    canvas.width = w; canvas.height = 60;
    ctx.font = font; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(2,6,23,0.78)'; ctx.fillRect(0, 0, w, 60);
    ctx.fillStyle = colorHex; ctx.fillText(text, 12, 32);
    const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    spr.scale.set(s * w / 60, s, 1);
    spr.traverse(o => o.userData.isLoad = true);
    return spr;
  }

  function momentArrow(axis, R, color) {
    const g = new THREE.Group();
    const arc = Math.PI * 1.15;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(R, 0.025, 8, 40, arc), new THREE.MeshBasicMaterial({ color }));
    g.add(torus);
    const end = new THREE.Vector3(Math.cos(arc) * R, Math.sin(arc) * R, 0);
    const tang = new THREE.Vector3(-Math.sin(arc), Math.cos(arc), 0).normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 12), new THREE.MeshBasicMaterial({ color }));
    cone.position.copy(end);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tang);
    g.add(cone);
    if (axis === 'y') g.rotation.y = Math.PI / 2;
    g.traverse(o => o.userData.isLoad = true);
    return g;
  }

  function getMandrelRadius(db) { const D = MANDREL_D[db.toFixed(2)] || 6.0 * db; return (D / 2) / 100; }

  function drawHook(pos, axis, dirSign, db, hookType, isTop, mat, group) {
    const R = getMandrelRadius(db), r = db / 200;
    const barDir = new THREE.Vector3(); barDir[axis] = dirSign;
    const inwardDir = barDir.clone().negate();
    const upDir = isTop ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 1, 0);
    const center = pos.clone().add(upDir.clone().multiplyScalar(R));
    const startAngle = -Math.PI / 2, endAngle = (hookType === 90) ? 0 : Math.PI / 2;
    const pts = [pos.clone(), pos.clone().add(barDir.clone().multiplyScalar(0.001))];
    for (let i = 1; i <= 32; i++) {
      const th = startAngle + (i / 32) * (endAngle - startAngle);
      pts.push(center.clone().add(barDir.clone().multiplyScalar(R * Math.cos(th))).add(upDir.clone().multiplyScalar(R * Math.sin(th))));
    }
    const straightDir = (hookType === 90) ? upDir : inwardDir;
    const straightLen = (hookType === 90) ? Math.max(12 * db / 100, 0.06) : Math.max(4 * db / 100, 0.07);
    const tail = pts[pts.length - 1];
    for (let i = 1; i <= 6; i++) pts.push(tail.clone().add(straightDir.clone().multiplyScalar(straightLen / 6 * i)));
    const hook = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8, false), mat);
    hook.userData.isRebar = true; group.add(hook);
    return R;
  }

  function build3D(d) {
    while (foundationGroup.children.length) foundationGroup.remove(foundationGroup.children[0]);
    if (pressureMesh) { scene.remove(pressureMesh); pressureMesh = null; }
    if (loadsGroup) { scene.remove(loadsGroup); loadsGroup = null; }
    if (!d || !d.input) return;

    const I = d.input;
    const B = I.B || 1.8, L = I.L || 1.8, h = I.h || 0.45;
    const colA = I.colA || 30, colB = I.colB || 30;
    const pedA = I.pedA || colA, pedB = I.pedB || colB, pedH = I.pedH || 60;
    const sol = I.sol || 5, rec = I.rec || 7.5;
    const dbX = I.dbX || 1.27, dbY = I.dbY || 1.27;
    const hasTop = d.hasTop || false;
    const dbTopX = d.dbTopX || 1.27, dbTopY = d.dbTopY || 1.27;
    const hooks = d.hooks || {};

    const solMesh = new THREE.Mesh(new THREE.BoxGeometry(B + 0.1, sol / 100, L + 0.1), new THREE.MeshStandardMaterial({ color: 0x64748b }));
    solMesh.position.y = sol / 200; foundationGroup.add(solMesh);
    const zapMesh = new THREE.Mesh(new THREE.BoxGeometry(B, h, L), new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.85 }));
    zapMesh.position.y = sol / 100 + h / 2; zapMesh.castShadow = true; foundationGroup.add(zapMesh);
    const pedMesh = new THREE.Mesh(new THREE.BoxGeometry(pedA / 100, pedH / 100, pedB / 100), new THREE.MeshStandardMaterial({ color: 0x64748b }));
    pedMesh.position.y = sol / 100 + h + pedH / 200; foundationGroup.add(pedMesh);
    const colMesh = new THREE.Mesh(new THREE.BoxGeometry(colA / 100, 1.5, colB / 100), new THREE.MeshStandardMaterial({ color: 0xdc2626, transparent: true, opacity: 0.7 }));
    colMesh.position.y = sol / 100 + h + pedH / 100 + 0.75; foundationGroup.add(colMesh);

    pressureMesh = new THREE.Mesh(new THREE.PlaneGeometry(B, L, 20, 20), new THREE.ShaderMaterial({
      uniforms: { qmin: { value: d.press.qmin }, qmax: { value: d.press.qmax }, qa: { value: I.qa } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float qmin,qmax,qa; void main(){ float t=(vUv.x-0.5)*2.0; float q=mix(qmin,qmax,(t+1.0)/2.0); float ratio=q/qa; vec3 color; if(ratio<0.7) color=vec3(0.09,0.64,0.29); else if(ratio<1.0) color=vec3(0.96,0.62,0.04); else color=vec3(0.86,0.15,0.15); gl_FragColor=vec4(color,0.7); }`,
      transparent: true
    }));
    pressureMesh.rotation.x = -Math.PI / 2; pressureMesh.position.y = sol / 100 + 0.001; foundationGroup.add(pressureMesh);

    loadsGroup = new THREE.Group(); scene.add(loadsGroup);
    const yC = sol / 100 + h + pedH / 100 + 1.5;
    const addArrow = (dirV, origin, len, hex, label, labelPos) => {
      const a = new THREE.ArrowHelper(dirV, origin, len, hex, Math.min(0.3, len * 0.35), 0.14);
      a.traverse(o => o.userData.isLoad = true);
      loadsGroup.add(a);
      if (label) { const s = makeLabel(label, '#' + hex.toString(16).padStart(6, '0')); s.position.copy(labelPos); loadsGroup.add(s); }
    };
    if (Math.abs(I.Pu) > 1e-9) addArrow(new THREE.Vector3(0,-1,0), new THREE.Vector3(0, yC + 1.15, 0), 1.0, 0xdc2626, `Pu = ${I.Pu.toFixed(2)} T`, new THREE.Vector3(0, yC + 1.5, 0));
    if (Math.abs(I.Hux) > 1e-9) addArrow(new THREE.Vector3(0,0,1), new THREE.Vector3(0, yC + 0.25, -1.15), 0.95, 0xf59e0b, `Qux = ${I.Hux.toFixed(2)} T`, new THREE.Vector3(0, yC + 0.55, -0.7));
    if (Math.abs(I.Huy) > 1e-9) addArrow(new THREE.Vector3(1,0,0), new THREE.Vector3(-1.15, yC + 0.25, 0), 0.95, 0xf59e0b, `Quy = ${I.Huy.toFixed(2)} T`, new THREE.Vector3(-0.7, yC + 0.55, 0));
    if (Math.abs(I.Mux) > 1e-9) { const m = momentArrow('x', 0.5, 0x60a5fa); m.position.set(0, yC + 0.55, 0); loadsGroup.add(m); const s = makeLabel(`Mux = ${I.Mux.toFixed(2)} T·m`, '#60a5fa'); s.position.set(1.15, yC + 0.8, 0); loadsGroup.add(s); }
    if (Math.abs(I.Muy) > 1e-9) { const m = momentArrow('y', 0.5, 0x60a5fa); m.position.set(0, yC + 0.55, 0); loadsGroup.add(m); const s = makeLabel(`Muy = ${I.Muy.toFixed(2)} T·m`, '#60a5fa'); s.position.set(0, yC + 0.8, 1.15); loadsGroup.add(s); }

    const qavg = (I.P || 0) / (B * L);
    const Sx = L * B * B / 6, Sy = B * L * L / 6;
    const y0 = sol / 100;
    for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 5; iz++) {
      const x = -B / 2 + B * (ix + 0.5) / 5;
      const z = -L / 2 + L * (iz + 0.5) / 5;
      const q = qavg + (I.Mx / Sx) * (x / (B / 2)) + (I.My / Sy) * (z / (L / 2));
      const len = 0.12 + 0.5 * Math.max(q, 0) / (Math.abs(d.press.qmax) || 1);
      const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y0 - len - 0.02, z), len, 0xdc2626, len * 0.4, 0.05);
      a.traverse(o => o.userData.isLoad = true);
      loadsGroup.add(a);
    }
    const sMx = Math.sign(I.Mx || 0), sMy = Math.sign(I.My || 0);
    const sMax = makeLabel(`qmax = ${d.press.qmax.toFixed(2)} kg/cm²`, '#dc2626');
    sMax.position.set(sMy * B / 2, y0 - 0.9, sMx * L / 2); loadsGroup.add(sMax);
    const sMin = makeLabel(`qmin = ${d.press.qmin.toFixed(2)} kg/cm²`, '#f59e0b');
    sMin.position.set(-sMy * B / 2, y0 - 0.9, -sMx * L / 2); loadsGroup.add(sMin);

    const cover = rec / 100;
    const yBar = sol / 100 + cover + Math.max(dbX, dbY) / 200;
    const yTop = sol / 100 + h - cover - Math.max(dbTopX, dbTopY) / 200;
    const sp = (on, db) => on ? getMandrelRadius(db) : 0;
    const lenX = Math.max(0.1, (B - 2 * cover) - 2 * sp(hooks.hookX, dbX));
    const lenY = Math.max(0.1, (L - 2 * cover) - 2 * sp(hooks.hookY, dbY));
    const lenTopX = Math.max(0.1, (B - 2 * cover) - 2 * sp(hooks.hookTopX, dbTopX));
    const lenTopY = Math.max(0.1, (L - 2 * cover) - 2 * sp(hooks.hookTopY, dbTopY));
    const matX = new THREE.MeshStandardMaterial({ color: 0x16A34A, metalness: 0.6, roughness: 0.3 });
    const matY = new THREE.MeshStandardMaterial({ color: 0x16A34A, metalness: 0.6, roughness: 0.3 });
    const matTop = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.3 });

    const geoX = new THREE.CylinderGeometry(dbX / 200, dbX / 200, lenX, 8); geoX.rotateZ(Math.PI / 2);
    if (d.layout && d.layout.y) for (let i = 0; i < d.layout.y.n; i++) {
      const zPos = -L / 2 + cover + i * d.layout.y.s / 100;
      const bar = new THREE.Mesh(geoX, matX); bar.position.set(0, yBar, zPos); bar.userData.isRebar = true; foundationGroup.add(bar);
      if (hooks.hookX) { const ht = hooks.hookTypeX || 90; drawHook(new THREE.Vector3(-lenX / 2, yBar, zPos), 'x', -1, dbX, ht, false, matX, foundationGroup); drawHook(new THREE.Vector3(lenX / 2, yBar, zPos), 'x', 1, dbX, ht, false, matX, foundationGroup); }
    }
    const geoY = new THREE.CylinderGeometry(dbY / 200, dbY / 200, lenY, 8); geoY.rotateX(Math.PI / 2);
    if (d.layout && d.layout.x) for (let i = 0; i < d.layout.x.n; i++) {
      const xPos = -B / 2 + cover + i * d.layout.x.s / 100;
      const bar = new THREE.Mesh(geoY, matY); bar.position.set(xPos, yBar + dbX / 100, 0); bar.userData.isRebar = true; foundationGroup.add(bar);
      if (hooks.hookY) { const ht = hooks.hookTypeY || 90; drawHook(new THREE.Vector3(xPos, yBar + dbX / 100, -lenY / 2), 'z', -1, dbY, ht, false, matY, foundationGroup); drawHook(new THREE.Vector3(xPos, yBar + dbX / 100, lenY / 2), 'z', 1, dbY, ht, false, matY, foundationGroup); }
    }
    if (hasTop) {
      const gTX = new THREE.CylinderGeometry(dbTopX / 200, dbTopX / 200, lenTopX, 8); gTX.rotateZ(Math.PI / 2);
      if (d.layout && d.layout.y) for (let i = 0; i < d.layout.y.n; i++) {
        const zPos = -L / 2 + cover + i * d.layout.y.s / 100;
        const bar = new THREE.Mesh(gTX, matTop); bar.position.set(0, yTop, zPos); bar.userData.isRebar = true; foundationGroup.add(bar);
        if (hooks.hookTopX) { const ht = hooks.hookTypeTopX || 90; drawHook(new THREE.Vector3(-lenTopX / 2, yTop, zPos), 'x', -1, dbTopX, ht, true, matTop, foundationGroup); drawHook(new THREE.Vector3(lenTopX / 2, yTop, zPos), 'x', 1, dbTopX, ht, true, matTop, foundationGroup); }
      }
      const gTY = new THREE.CylinderGeometry(dbTopY / 200, dbTopY / 200, lenTopY, 8); gTY.rotateX(Math.PI / 2);
      if (d.layout && d.layout.x) for (let i = 0; i < d.layout.x.n; i++) {
        const xPos = -B / 2 + cover + i * d.layout.x.s / 100;
        const bar = new THREE.Mesh(gTY, matTop); bar.position.set(xPos, yTop + dbTopX / 100, 0); bar.userData.isRebar = true; foundationGroup.add(bar);
        if (hooks.hookTopY) { const ht = hooks.hookTypeTopY || 90; drawHook(new THREE.Vector3(xPos, yTop + dbTopX / 100, -lenTopY / 2), 'z', -1, dbTopY, ht, true, matTop, foundationGroup); drawHook(new THREE.Vector3(xPos, yTop + dbTopX / 100, lenTopY / 2), 'z', 1, dbTopY, ht, true, matTop, foundationGroup); }
      }
    }

    updateVisibility();
  }

    // ============ GUARDAR / CARGAR PROYECTO (.json) ============
    const JSON_MAP = [
      ['B','in-B'],['L','in-L'],['h','in-h'],['rec','in-rec'],['colA','in-col-a'],['colB','in-col-b'],
      ['pedA','in-pedA'],['pedB','in-pedB'],['pedH','in-ped-h'],['sol','in-sol'],
      ['fc','in-fc'],['fy','in-fy'],['gc','in-gc'],['qa','in-qa'],['gs','in-gs'],['NF','in-nf'],
      ['k','in-k'],['delta','in-delta'],['Df','in-df'],['cp','in-cp'],['phi','in-phi'],
      ['P','in-P'],['Mx','in-Mx'],['My','in-My'],['Hx','in-Hx'],['Hy','in-Hy'],
      ['Pu','in-Pu'],['Mux','in-Mux'],['Muy','in-Muy'],['Hux','in-Hux'],['Huy','in-Huy'],
      ['dbX','in-db-x'],['dbY','in-db-y'],['sX','in-s-x'],['sY','in-s-y'],
      ['dbTopX','in-db-top-x'],['dbTopY','in-db-top-y'],['sTopX','in-s-top-x'],['sTopY','in-s-top-y'],
      ['hookTypeX','in-hook-x'],['hookTypeY','in-hook-y'],['hookTypeTopX','in-hook-top-x'],['hookTypeTopY','in-hook-top-y'],
      ['dbCol','in-db-col'],['nCol','in-n-col']
    ];
    const JSON_CHK = [
      ['hasTop','chk-top-rebar'],['hookX','chk-hook-x'],['hookY','chk-hook-y'],
      ['hookTopX','chk-hook-top-x'],['hookTopY','chk-hook-top-y']
    ];
  
    function saveJSON() {
      if (!currentData) { alert('Primero ejecute un cálculo.'); return; }
      const payload = {
        app: 'FoundationPro NSR-10', version: 1,
        fecha: new Date().toISOString(),
        meta: currentData.meta || readMeta(),
        input: readInput()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Zapata_${payload.meta.id || 'Z1'}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  
    function loadJSONFile(file) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const obj = JSON.parse(e.target.result);
          const inp = obj.input || {};
          JSON_MAP.forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (el && inp[key] !== undefined) el.value = inp[key];
          });
          JSON_CHK.forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (el) el.checked = !!inp[key];
          });
          const topSec = document.getElementById('top-rebar-section');
          if (topSec) topSec.style.display = inp.hasTop ? 'block' : 'none';
          ['x','y','top-x','top-y'].forEach(dir => {
            const key = dir.startsWith('top') ? (dir === 'top-x' ? 'hookTopX' : 'hookTopY') : (dir === 'x' ? 'hookX' : 'hookY');
            const op = document.getElementById(`hook-${dir}-options`);
            if (op) op.style.display = inp[key] ? 'block' : 'none';
          });
          if (obj.meta) {
            const setT = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
            setT('in-proj', obj.meta.project); setT('in-zid', obj.meta.id);
            setT('in-date', obj.meta.date); setT('in-elab', obj.meta.elaboro); setT('in-rev', obj.meta.reviso);
          }
          compute();
          alert('✅ Proyecto cargado correctamente.');
        } catch (err) {
          alert('❌ Archivo JSON inválido: ' + err.message);
        }
      };
      reader.readAsText(file);
    }

  function snapshot3D() {
    try { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); }
    catch (e) { return null; }
  }

  return { init, snapshot3D, redraw: redrawViews };
})();

window.addEventListener('DOMContentLoaded', App.init);