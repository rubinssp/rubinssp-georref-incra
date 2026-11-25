/* Georref INCRA — núcleo de cálculos (geodésia, verificações, ODS, KML)
   SIRGAS 2000 / GRS80. Sem dependências externas. */
(function (G) {
  'use strict';

  // ---------- Elipsoide GRS80 ----------
  const a = 6378137.0, f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const RAD = Math.PI / 180, DEG = 180 / Math.PI;

  // ---------- UTM (série de Krüger) ----------
  const n = f / (2 - f), n2 = n * n, n3 = n2 * n;
  const A = a / (1 + n) * (1 + n2 / 4 + n2 * n2 / 64);
  const alpha = [n / 2 - 2 * n2 / 3 + 5 * n3 / 16, 13 * n2 / 48 - 3 * n3 / 5, 61 * n3 / 240];
  const beta = [n / 2 - 2 * n2 / 3 + 37 * n3 / 96, n2 / 48 + n3 / 15, 17 * n3 / 480];
  const delta = [2 * n - 2 * n2 / 3 - 2 * n3, 7 * n2 / 3 - 8 * n3 / 5, 56 * n3 / 15];
  const k0 = 0.9996;

  function mc(fuso) { return -183 + 6 * fuso; }

  function utmParaGeo(E, N, fuso, hemisferio) {
    const N0 = hemisferio === 'N' ? 0 : 10000000;
    const xi = (N - N0) / (k0 * A), eta = (E - 500000) / (k0 * A);
    let xp = xi, ep = eta;
    for (let j = 1; j <= 3; j++) {
      xp -= beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
      ep -= beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    }
    const chi = Math.asin(Math.sin(xp) / Math.cosh(ep));
    let phi = chi;
    for (let j = 1; j <= 3; j++) phi += delta[j - 1] * Math.sin(2 * j * chi);
    const lam = mc(fuso) * RAD + Math.atan2(Math.sinh(ep), Math.cos(xp));
    return { lat: phi * DEG, lon: lam * DEG };
  }

  function geoParaUtm(lat, lon, fuso, hemisferio) {
    const phi = lat * RAD, dl = (lon - mc(fuso)) * RAD;
    const c = 2 * Math.sqrt(n) / (1 + n);
    const t = Math.sinh(Math.atanh(Math.sin(phi)) - c * Math.atanh(c * Math.sin(phi)));
    const xp = Math.atan2(t, Math.cos(dl));
    const ep = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
    let E = ep, N = xp;
    for (let j = 1; j <= 3; j++) {
      E += alpha[j - 1] * Math.cos(2 * j * xp) * Math.sinh(2 * j * ep);
      N += alpha[j - 1] * Math.sin(2 * j * xp) * Math.cosh(2 * j * ep);
    }
    return { E: 500000 + k0 * A * E, N: (hemisferio === 'N' ? 0 : 10000000) + k0 * A * N };
  }

  // ---------- Sistema Geodésico Local (SGL) ----------
  function geoParaEcef(lat, lon, h) {
    const p = lat * RAD, l = lon * RAD, s = Math.sin(p);
    const Nn = a / Math.sqrt(1 - e2 * s * s);
    return [(Nn + h) * Math.cos(p) * Math.cos(l), (Nn + h) * Math.cos(p) * Math.sin(l), (Nn * (1 - e2) + h) * s];
  }

  // Converte lista de vértices {lat,lon,h} para coordenadas planas locais (E,N) com origem no centroide
  function ecefParaGeo(X, Y, Z) {
    const lon = Math.atan2(Y, X), p = Math.hypot(X, Y);
    let lat = Math.atan2(Z, p * (1 - e2)), h = 0;
    for (let k = 0; k < 8; k++) {
      const s = Math.sin(lat), Nn = a / Math.sqrt(1 - e2 * s * s);
      h = p / Math.cos(lat) - Nn;
      lat = Math.atan2(Z, p * (1 - e2 * Nn / (Nn + h)));
    }
    return { lat: lat * DEG, lon: lon * DEG, h };
  }

  // SGL: origem na média das coordenadas cartesianas geocêntricas (Manual Técnico de Posicionamento)
  function paraSGL(vs) {
    const xs = vs.map(v => geoParaEcef(v.lat, v.lon, v.h || 0));
    const o = [0, 1, 2].map(k => xs.reduce((t, x) => t + x[k], 0) / xs.length);
    const g = ecefParaGeo(o[0], o[1], o[2]);
    const sp = Math.sin(g.lat * RAD), cp = Math.cos(g.lat * RAD), sl = Math.sin(g.lon * RAD), cl = Math.cos(g.lon * RAD);
    return xs.map(x => {
      const dx = x[0] - o[0], dy = x[1] - o[1], dz = x[2] - o[2];
      return { e: -sl * dx + cl * dy, n: -sp * cl * dx - sp * sl * dy + cp * dz };
    });
  }

  // Problema geodésico inverso (Vincenty, GRS80) — azimute em graus
  function azimuteGeodesico(lat1, lon1, lat2, lon2) {
    const b = a * (1 - f), L = (lon2 - lon1) * RAD;
    const U1 = Math.atan((1 - f) * Math.tan(lat1 * RAD)), U2 = Math.atan((1 - f) * Math.tan(lat2 * RAD));
    const sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2);
    let lam = L, it = 0, sl, cl, ss, cs, sig, sa, c2a, c2m;
    do {
      sl = Math.sin(lam); cl = Math.cos(lam);
      ss = Math.hypot(cU2 * sl, cU1 * sU2 - sU1 * cU2 * cl);
      if (ss === 0) return 0;
      cs = sU1 * sU2 + cU1 * cU2 * cl; sig = Math.atan2(ss, cs);
      sa = cU1 * cU2 * sl / ss; c2a = 1 - sa * sa;
      c2m = c2a ? cs - 2 * sU1 * sU2 / c2a : 0;
      const C = f / 16 * c2a * (4 + f * (4 - 3 * c2a));
      const lp = lam;
      lam = L + (1 - C) * f * sa * (sig + C * ss * (c2m + C * cs * (-1 + 2 * c2m * c2m)));
      if (Math.abs(lam - lp) < 1e-13) break;
    } while (++it < 200);
    let az = Math.atan2(cU2 * Math.sin(lam), cU1 * sU2 - sU1 * cU2 * Math.cos(lam)) * DEG;
    return (az + 360) % 360;
  }

  function distGeocentrica(v1, v2) {
    const p = geoParaEcef(v1.lat, v1.lon, v1.h || 0), q = geoParaEcef(v2.lat, v2.lon, v2.h || 0);
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  }

  function areaAssinada(p) { // >0 anti-horário
    let s = 0;
    for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; s += p[i].e * p[j].n - p[j].e * p[i].n; }
    return s / 2;
  }

  // Como no SIGEF: azimute geodésico (problema inverso); distância pelas coordenadas cartesianas geocêntricas
  function lados(vs) {
    return vs.map((v, i) => {
      const w = vs[(i + 1) % vs.length];
      return { dist: distGeocentrica(v, w), az: azimuteGeodesico(v.lat, v.lon, w.lat, w.lon) };
    });
  }

  function resumo(vs) {
    if (vs.length < 3) return { area: 0, perimetro: 0, horario: true };
    const p = paraSGL(vs);
    const s = areaAssinada(p);
    const per = lados(vs).reduce((t, l) => t + l.dist, 0);
    return { area: Math.abs(s), perimetro: per, horario: s < 0 };
  }

  function cruza(p1, p2, p3, p4) {
    const d = (a, b, c) => (b.e - a.e) * (c.n - a.n) - (b.n - a.n) * (c.e - a.e);
    const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  function autoIntersecoes(vs) {
    const p = paraSGL(vs), m = p.length, out = [];
    for (let i = 0; i < m; i++) for (let j = i + 2; j < m; j++) {
      if (i === 0 && j === m - 1) continue;
      if (cruza(p[i], p[(i + 1) % m], p[j], p[(j + 1) % m])) out.push([i, j]);
    }
    return out;
  }

  // ---------- Formatação ----------
  function dms(v, dec, hemPos, hemNeg) {
    const hem = v < 0 ? hemNeg : hemPos;
    let x = Math.abs(v);
    let g = Math.floor(x), mm = Math.floor((x - g) * 60), s = ((x - g) * 60 - mm) * 60;
    s = Number(s.toFixed(dec));
    if (s >= 60) { s -= 60; mm += 1; }
    if (mm >= 60) { mm -= 60; g += 1; }
    const ss = s.toFixed(dec).padStart(3 + dec, '0');
    return `${String(g).padStart(2, '0')} ${String(mm).padStart(2, '0')} ${ss}`.replace('.', ',') + ' ' + hem;
  }
  function dmsTexto(v, dec, hemPos, hemNeg) { // 53°18'22,123" W
    const p = dms(v, dec, hemPos, hemNeg).split(' ');
    return `${p[0]}°${p[1]}'${p[2]}" ${p[3]}`;
  }
  function azTexto(az) {
    let g = Math.floor(az), mm = Math.floor((az - g) * 60), s = Math.round(((az - g) * 60 - mm) * 60);
    if (s === 60) { s = 0; mm++; } if (mm === 60) { mm = 0; g++; } if (g === 360) g = 0;
    return `${g}°${String(mm).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
  }
  function num(v, d) { return Number(v).toFixed(d).replace('.', ','); }
  function numBR(v, d) { return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  // ---------- Tabelas da Norma (NTGIR 3ª ed. / Manual Técnico) ----------
  const METODOS = {
    PG1: ['Relativo estático', 'AN', 'MP'], PG2: ['Relativo estático-rápido', 'AN', 'MP'],
    PG3: ['Relativo semicinemático', 'AN', 'MP'], PG4: ['Relativo cinemático', 'AN', 'P'],
    PG5: ['Relativo a partir de códigos', 'N', 'P'], PG6: ['RTK convencional / RTPPP', 'AN', 'MP'],
    PG7: ['RTK em rede', 'AN', 'MP'], PG8: ['DGPS', 'N', 'P'], PG9: ['PPP', 'AN', 'MP'],
    PT1: ['Poligonação', 'AN', 'MP'], PT2: ['Triangulação', 'AN', 'MP'], PT3: ['Trilateração', 'AN', 'MP'],
    PT4: ['Triangulateração', 'AN', 'MP'], PT5: ['Irradiação', 'AN', 'MP'], PT6: ['Interseção linear', 'AN', 'MPV'],
    PT7: ['Interseção angular', 'AN', 'MPV'], PT8: ['Alinhamento', 'AN', 'MP'], PT9: ['Estação livre', 'AN', 'MP'],
    PA1: ['Paralela', 'AN', 'V'], PA2: ['Interseção de retas', 'AN', 'V'], PA3: ['Projeção técnica', 'ANI', 'V'],
    PS1: ['Aerofotogrametria', 'ANI', 'V'], PS2: ['Radar aerotransportado', 'ANI', 'V'],
    PS3: ['Laser scanner aerotransportado', 'ANI', 'V'], PS4: ['Sensores orbitais', 'ANI', 'V'],
    PB1: ['Base cartográfica com precisão conhecida', 'ANI', 'V'], PB2: ['Base cartográfica sem precisão conhecida', 'ANI', 'V']
  };
  const LIMITES = {
    LA1: 'Cerca', LA2: 'Muro', LA3: 'Estrada', LA4: 'Vala', LA5: 'Canal', LA6: 'Linha ideal', LA7: 'Limite artificial não tipificado',
    LN1: 'Corpo d’água ou curso d’água', LN2: 'Linha de cumeada', LN3: 'Grota', LN4: 'Crista de encosta', LN5: 'Pé de encosta', LN6: 'Limite natural não tipificado'
  };
  const PRECISAO = { A: 0.50, N: 3.00, I: 7.50 };

  function precisaoPosicional(v) { return Math.hypot(+v.sl || 0, +v.sb || 0); }

  // Limite mais exigente entre os dois lados que chegam ao vértice
  function limiteExigido(vs, i) {
    const ant = vs[(i - 1 + vs.length) % vs.length].limite, pos = vs[i].limite;
    const cls = [ant, pos].map(c => (c || '').startsWith('LN') ? 'N' : 'A');
    if (vs[i].inacessivel) return PRECISAO.I;
    return Math.min(PRECISAO[cls[0]], PRECISAO[cls[1]]);
  }

  function gerarCodigos(vs, credenciado, inicio) {
    const cont = { M: +inicio.M || 1, P: +inicio.P || 1, V: +inicio.V || 1 };
    const cred = (credenciado || 'XXXX').trim().toUpperCase();
    vs.forEach(v => { const t = v.tipo || 'P'; v.codigo = `${cred}-${t}-${String(cont[t]++).padStart(4, '0')}`; });
    return cont;
  }

  function verificar(vs, opts) {
    opts = opts || {};
    const erros = [], avisos = [];
    if (vs.length < 3) erros.push({ msg: 'O perímetro precisa de pelo menos 3 vértices.' });
    const vistos = {};
    vs.forEach((v, i) => {
      const id = v.codigo || v.nome || ('#' + (i + 1));
      if (!v.codigo) erros.push({ i, msg: `${id}: sem código SIGEF (clique em “Gerar códigos”).` });
      else {
        if (v.codigo.length < 7) erros.push({ i, msg: `${id}: código muito curto.` });
        if (vistos[v.codigo] !== undefined) erros.push({ i, msg: `${id}: código repetido (também no vértice ${vistos[v.codigo] + 1}).` });
        vistos[v.codigo] = i;
        if (!/^XXXX-/.test(v.codigo) && v.codigo.split('-')[0].length !== 4) avisos.push({ i, msg: `${id}: o código do credenciado deve ter 4 caracteres.` });
        if (/^XXXX-/.test(v.codigo)) avisos.push({ i, msg: `${id}: código do credenciado ainda é “XXXX” — troque pelo código do responsável técnico antes de enviar.`, grupo: 'cred' });
      }
      if (!isFinite(v.lat) || !isFinite(v.lon)) erros.push({ i, msg: `${id}: coordenadas inválidas.` });
      if (!isFinite(v.h)) avisos.push({ i, msg: `${id}: sem altitude (será gravado 0,00).` });
      const m = METODOS[v.metodo];
      if (!m) erros.push({ i, msg: `${id}: método de posicionamento inválido (${v.metodo || 'vazio'}).` });
      else {
        if (!m[2].includes(v.tipo)) erros.push({ i, msg: `${id}: método ${v.metodo} (${m[0]}) não é aceito para vértice tipo ${v.tipo}.` });
        const lims = [vs[(i - 1 + vs.length) % vs.length].limite, v.limite];
        if (m[1] === 'N' && lims.some(l => (l || '').startsWith('LA'))) erros.push({ i, msg: `${id}: método ${v.metodo} só pode ser usado em limite natural (LN).` });
      }
      if (!LIMITES[v.limite]) erros.push({ i, msg: `${id}: tipo de limite inválido no lado que sai deste vértice.` });
      if (v.limite === 'LA6' && v.tipo !== 'M') avisos.push({ i, msg: `${id}: linha ideal (LA6) deve, sempre que possível, ter vértices tipo M (ou justificativa técnica).` });
      if (!v.conf || v.conf.trim().length < 3) erros.push({ i, msg: `${id}: confrontante do lado que sai deste vértice está vazio ou curto.` });
      if (v.tipo !== 'V') {
        if (!(+v.sl > 0) || !(+v.sb > 0)) erros.push({ i, msg: `${id}: sigma de latitude/longitude ausente.` });
        const pp = precisaoPosicional(v), lim = limiteExigido(vs, i);
        if (pp > lim) erros.push({ i, msg: `${id}: precisão posicional ${num(pp, 3)} m acima do limite de ${num(lim, 2)} m.` });
      }
      if (v.solucao && !/fix|fixo|fixed/i.test(v.solucao)) avisos.push({ i, msg: `${id}: solução “${v.solucao}” — em RTK, limite artificial exige solução FIXA.` });
    });
    if (opts.altTipo === 'ort') avisos.push({ msg: 'A coluna “h” do SIGEF é altitude geométrica (elipsoidal); os pontos foram importados como ortométrica.' });
    if (vs.length >= 3) {
      const r = resumo(vs);
      if (!r.horario) avisos.push({ msg: 'Os vértices estão no sentido anti-horário. Use “Sentido horário” na aba Vértices.' });
      autoIntersecoes(vs).forEach(([i, j]) => erros.push({ i, msg: `O lado ${i + 1}→${i + 2} cruza o lado ${j + 1}→${(j + 1) % vs.length + 1} (polígono se autointercepta).` }));
      lados(vs).forEach((l, i) => { if (l.dist < 0.01) erros.push({ i, msg: `Vértices ${i + 1} e ${(i + 1) % vs.length + 1} coincidentes.` }); });
    }
    return { erros, avisos };
  }

  // Linhas no layout da aba perimetro do SIGEF (12 colunas)
  function linhasSigef(vs, o) {
    const dc = o.decCoord || 3, dp = o.decPrec || 2;
    return vs.map(v => [
      v.codigo,
      dms(v.lon, dc, 'E', 'W'), num(v.sl || 0, dp),
      dms(v.lat, dc, 'N', 'S'), num(v.sb || 0, dp),
      num(isFinite(v.h) ? v.h : 0, dp), num(v.sh || 0, dp),
      v.metodo, v.limite, v.cns || '', v.mat || '', (v.conf || '').trim()
    ]);
  }

  // ---------- ZIP mínimo (leitura e escrita) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  async function inflar(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function lerZip(buf) {
    const u = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Arquivo não é um ODS/ZIP válido.');
    const total = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
    const td = new TextDecoder(), out = [];
    for (let k = 0; k < total; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP corrompido.');
      const metodo = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const nome = td.decode(u.subarray(p + 46, p + 46 + nl));
      const lnl = dv.getUint16(off + 26, true), lxl = dv.getUint16(off + 28, true);
      const dados = u.subarray(off + 30 + lnl + lxl, off + 30 + lnl + lxl + csize);
      out.push({ nome, dados: metodo === 0 ? dados.slice() : await inflar(dados) });
      p += 46 + nl + xl + cl;
    }
    return out;
  }

  async function comprimir(bytes) {
    const cs = new CompressionStream('deflate-raw');
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer());
  }

  async function escreverZip(arqs) { // mimetype primeiro e sem compressão; demais comprimidos (deflate)
    arqs = arqs.slice().sort((x, y) => (y.nome === 'mimetype') - (x.nome === 'mimetype'));
    const te = new TextEncoder(), partes = [], central = []; let off = 0;
    for (const f of arqs) {
      const nm = te.encode(f.nome), d = f.dados, crc = crc32(d);
      let metodo = 0, z = d;
      if (f.nome !== 'mimetype' && d.length > 64 && typeof CompressionStream !== 'undefined') {
        const c = await comprimir(d); if (c.length < d.length) { metodo = 8; z = c; }
      }
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, metodo, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, z.length, true); h.setUint32(22, d.length, true);
      h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      partes.push(new Uint8Array(h.buffer), nm, z);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, metodo, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, z.length, true); c.setUint32(24, d.length, true);
      c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + z.length;
    }
    const tamC = central.reduce((s, x) => s + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, arqs.length, true); e.setUint16(10, arqs.length, true);
    e.setUint32(12, tamC, true); e.setUint32(16, off, true);
    return new Blob([...partes, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.oasis.opendocument.spreadsheet' });
  }

  // ---------- Preenchimento da planilha ODS oficial do SIGEF ----------
  const NS = {
    table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
    office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
    text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
    calcext: 'urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0'
  };

  function linhasDaTabela(tab) {
    const out = [];
    (function rec(el) {
      for (const c of Array.from(el.children)) {
        if (c.namespaceURI !== NS.table) continue;
        if (c.localName === 'table-row') out.push(c);
        else if (['table-rows', 'table-header-rows', 'table-row-group'].includes(c.localName)) rec(c);
      }
    })(tab);
    return out;
  }

  function separarRepeticao(el, attr, idx) { // garante que o elemento na posição idx (dentro de el repetido) fique isolado
    const rep = +el.getAttributeNS(NS.table, attr) || 1;
    if (rep === 1) return el;
    const antes = idx, depois = rep - idx - 1;
    const alvo = el.cloneNode(true); alvo.removeAttributeNS(NS.table, attr);
    if (antes > 0) { const c = el.cloneNode(true); if (antes > 1) c.setAttributeNS(NS.table, 'table:' + attr, antes); else c.removeAttributeNS(NS.table, attr); el.parentNode.insertBefore(c, el); }
    el.parentNode.insertBefore(alvo, el);
    if (depois > 0) { if (depois > 1) el.setAttributeNS(NS.table, 'table:' + attr, depois); else el.removeAttributeNS(NS.table, attr); }
    else el.parentNode.removeChild(el);
    return alvo;
  }

  function obterLinha(tab, idx) {
    let pos = 0;
    for (const r of linhasDaTabela(tab)) {
      const rep = +r.getAttributeNS(NS.table, 'number-rows-repeated') || 1;
      if (idx < pos + rep) return separarRepeticao(r, 'number-rows-repeated', idx - pos);
      pos += rep;
    }
    const doc = tab.ownerDocument, lr = linhasDaTabela(tab), ult = lr[lr.length - 1];
    let r;
    while (pos <= idx) { r = doc.createElementNS(NS.table, 'table:table-row'); (ult ? ult.parentNode : tab).appendChild(r); pos++; }
    return r;
  }

  function obterCelula(row, idx) {
    let pos = 0;
    for (const c of Array.from(row.children)) {
      if (c.namespaceURI !== NS.table || !['table-cell', 'covered-table-cell'].includes(c.localName)) continue;
      const rep = +c.getAttributeNS(NS.table, 'number-columns-repeated') || 1;
      if (idx < pos + rep) return separarRepeticao(c, 'number-columns-repeated', idx - pos);
      pos += rep;
    }
    let c;
    while (pos <= idx) { c = row.ownerDocument.createElementNS(NS.table, 'table:table-cell'); row.appendChild(c); pos++; }
    return c;
  }

  function definirCelula(cel, valor, numero) {
    while (cel.firstChild) cel.removeChild(cel.firstChild);
    ['value-type', 'value', 'string-value', 'formula'].forEach(a => { cel.removeAttributeNS(NS.office, a); cel.removeAttributeNS(NS.table, a); });
    cel.removeAttributeNS(NS.calcext, 'value-type');
    if (valor === '' || valor === null || valor === undefined) return;
    const doc = cel.ownerDocument;
    if (numero) {
      cel.setAttributeNS(NS.office, 'office:value-type', 'float');
      cel.setAttributeNS(NS.office, 'office:value', String(numero.v));
      cel.setAttributeNS(NS.calcext, 'calcext:value-type', 'float');
    } else {
      cel.setAttributeNS(NS.office, 'office:value-type', 'string');
      cel.setAttributeNS(NS.calcext, 'calcext:value-type', 'string');
    }
    const p = doc.createElementNS(NS.text, 'text:p'); p.textContent = valor; cel.appendChild(p);
  }

  function textoCelula(cel) { return (cel.textContent || '').trim(); }

  // Escreve os vértices a partir da linha 12 (índice 11) da aba perimetro_1
  async function preencherOds(buf, vs, o, ParserCls, SerializerCls) {
    const arqs = await lerZip(buf);
    const ent = arqs.find(x => x.nome === 'content.xml');
    if (!ent) throw new Error('content.xml não encontrado — é uma planilha ODS?');
    const doc = new ParserCls().parseFromString(new TextDecoder().decode(ent.dados), 'application/xml');
    const tabs = Array.from(doc.getElementsByTagNameNS(NS.table, 'table'));
    const nomeAba = o.aba || 'perimetro_1';
    const tab = tabs.find(t => t.getAttributeNS(NS.table, 'name') === nomeAba) || tabs.find(t => /perimetro/i.test(t.getAttributeNS(NS.table, 'name')));
    if (!tab) throw new Error('A planilha não tem aba “perimetro”. Use o modelo oficial baixado do SIGEF.');
    const L0 = 11, linhas = linhasSigef(vs, o), dp = o.decPrec || 2;
    linhas.forEach((ln, k) => {
      const v = vs[k], row = obterLinha(tab, L0 + k);
      const numCols = { 2: v.sl || 0, 4: v.sb || 0, 5: isFinite(v.h) ? v.h : 0, 6: v.sh || 0 };
      ln.forEach((val, c) => {
        const cel = obterCelula(row, c);
        if (c in numCols) definirCelula(cel, val, { v: Number((+numCols[c]).toFixed(dp)) });
        else definirCelula(cel, val);
      });
    });
    // limpa linhas antigas abaixo
    let extra = 0;
    for (let k = L0 + linhas.length; k < L0 + linhas.length + 3000; k++) {
      const rows = linhasDaTabela(tab); let pos = 0, alvo = null;
      for (const r of rows) { const rep = +r.getAttributeNS(NS.table, 'number-rows-repeated') || 1; if (k < pos + rep) { alvo = rep > 1 ? null : r; break; } pos += rep; }
      if (!alvo) break;
      const cels = Array.from(alvo.getElementsByTagNameNS(NS.table, 'table-cell')).slice(0, 12);
      if (!cels.some(c => textoCelula(c))) break;
      for (let c = 0; c < 12; c++) definirCelula(obterCelula(alvo, c), '');
      extra++;
    }
    const avisos = [];
    // cabeçalho do perímetro: coordenadas geográficas
    const formNS = 'urn:oasis:names:tc:opendocument:xmlns:form:1.0';
    const selecionar = (nome, rotulo) => {
      const lb = Array.from(doc.getElementsByTagNameNS(formNS, 'listbox')).find(x => x.getAttributeNS(formNS, 'name') === nome);
      if (!lb) return false;
      const ops = Array.from(lb.getElementsByTagNameNS(formNS, 'option'));
      const alvo = ops.find(op => (op.getAttributeNS(formNS, 'label') || '').trim() === rotulo);
      if (!alvo) return false;
      ops.forEach(op => { op.removeAttributeNS(formNS, 'current-selected'); op.removeAttributeNS(formNS, 'selected'); });
      alvo.setAttributeNS(formNS, 'form:current-selected', 'true'); alvo.setAttributeNS(formNS, 'form:selected', 'true');
      return true;
    };
    const cel = (t, r, c, v, numero) => definirCelula(obterCelula(obterLinha(t, r), c), v, numero);
    const temCabecalho = /tipo de coordenada/i.test(textoCelula(obterCelula(obterLinha(tab, 8), 0)));
    if (temCabecalho) {
      cel(tab, 0, 1, 'Geográfica'); cel(tab, 8, 1, 'Geográfica');
      selecionar('lstTypeCoord', 'Geográfica');
      if (o.fuso) { const m = String(-183 + 6 * o.fuso); cel(tab, 8, 3, m); selecionar('lstMeridianos', m); }
      const hem = o.hemisferio === 'N' ? 'Norte' : 'Sul'; cel(tab, 8, 5, hem); selecionar('lstHemisferio', hem);
      if (o.denominacaoPerimetro) cel(tab, 2, 1, o.denominacaoPerimetro);
    } else avisos.push('Cabeçalho da aba perímetro fora do padrão — confira “Tipo de Coordenada: Geográfica”.');

    // aba identificacao
    const id = o.ident, tid = tabs.find(t => t.getAttributeNS(NS.table, 'name') === 'identificacao');
    if (id && tid && /natureza do servi/i.test(textoCelula(obterCelula(obterLinha(tid, 1), 0)))) {
      const put = (r, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') cel(tid, r, 1, String(v).trim()); };
      put(1, id.natserv); put(4, id.pessoa); put(5, id.nome); put(9, id.denom); put(10, id.sit); put(11, id.natarea);
      const obrig = (r, v, rot) => { if (v && String(v).trim()) cel(tid, r, 1, String(v).trim()); else { cel(tid, r, 1, ''); avisos.push(`${rot} vazio na aba identificacao (o modelo trazia um valor de exemplo, que foi apagado).`); } };
      obrig(12, id.sncr, 'Código do imóvel (SNCR)'); obrig(13, id.cns, 'CNS do cartório');
      if (!id.mat) obrig(14, '', 'Matrícula');
      if (!id.nome) avisos.push('Nome do proprietário vazio.');
      if (id.mat) { const mn = id.mat.replace(/\./g, ''); if (/^\d+$/.test(mn)) cel(tid, 14, 1, mn, { v: +mn }); else put(14, id.mat); }
      if (id.transcricao) { cel(tid, 14, 0, 'Transcrição:'); selecionar('lstTipoIdentificacao', 'Transcrição:'); }
      if (id.cpf) {
        const d = id.cpf.replace(/\D/g, '');
        const fmt = d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : id.cpf;
        put(6, fmt);
        const ft = Array.from(doc.getElementsByTagNameNS(formNS, 'formatted-text')).find(x => x.getAttributeNS(formNS, 'name') === 'fieldCPF');
        if (ft) ft.setAttributeNS(formNS, 'form:current-value', fmt);
      }
      selecionar('lstTipoPessoa', id.pessoa);
      if (id.municipio) {
        const alvo = id.municipio.trim();
        const tp = tabs.find(t => t.getAttributeNS(NS.table, 'name') === 'parametros_controles');
        const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s*-\s*/g, '-').trim();
        let achado = null;
        if (tp) for (const p of tp.getElementsByTagNameNS(NS.text, 'p')) if (norm(p.textContent) === norm(alvo)) { achado = p.textContent.trim(); break; }
        if (achado || !tp) cel(tid, 16, 0, achado || alvo);
        else avisos.push(`Município “${alvo}” não está na lista do modelo — escolha na aba identificacao.`);
      }
      if (/jur/i.test(id.pessoa || '')) avisos.push('Pessoa jurídica: confira o campo CNPJ na aba identificacao.');
    } else if (id) avisos.push('Aba identificacao não reconhecida — preencha manualmente.');

    // métodos aceitos por esta versão do modelo
    const tpv = tabs.find(t => t.getAttributeNS(NS.table, 'name') === 'parametros_vertice');
    if (tpv) {
      const ps = Array.from(tpv.getElementsByTagNameNS(NS.text, 'p')).map(p => p.textContent);
      const lst = ps.find(s => /PG1;/.test(s));
      if (lst) {
        const ok = new Set(lst.split(';').map(s => s.trim()));
        const fora = [...new Set(vs.map(v => v.metodo).filter(m => !ok.has(m)))];
        if (fora.length) avisos.push(`Esta versão do modelo não lista o(s) método(s) ${fora.join(', ')} — baixe o modelo mais recente no SIGEF.`);
      }
    }

    ent.dados = new TextEncoder().encode(new SerializerCls().serializeToString(doc));
    return { blob: await escreverZip(arqs), aba: tab.getAttributeNS(NS.table, 'name'), limpas: extra, avisos };
  }

  // ---------- KML ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function kml(vs, nome) {
    const coords = vs.concat([vs[0]]).map(v => `${v.lon.toFixed(9)},${v.lat.toFixed(9)},${(v.h || 0).toFixed(3)}`).join(' ');
    const pts = vs.map(v => `<Placemark><name>${esc(v.codigo || v.nome)}</name><description>${esc(`${v.tipo} | ${v.metodo} | ${v.limite} | ${v.conf || ''}`)}</description><styleUrl>#v</styleUrl><Point><coordinates>${v.lon.toFixed(9)},${v.lat.toFixed(9)},${(v.h || 0).toFixed(3)}</coordinates></Point></Placemark>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(nome)}</name>
<Style id="p"><LineStyle><color>ff00ffff</color><width>2</width></LineStyle><PolyStyle><color>3300ffff</color></PolyStyle></Style>
<Style id="v"><IconStyle><scale>0.7</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>
<Placemark><name>${esc(nome)}</name><styleUrl>#p</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
${pts}
</Document></kml>`;
  }

  // ---------- Leitura de CSV/TXT ----------
  function lerTabela(txt) {
    txt = txt.replace(/^﻿/, '');
    const lin = txt.split(/\r?\n/).filter(l => l.trim());
    const amostra = lin.slice(0, 5).join('\n');
    const cand = ['\t', ';', ','].map(s => ({ s, n: amostra.split(s).length }));
    let sep = cand.sort((x, y) => y.n - x.n)[0].s;
    if (sep === ',' && /\d,\d/.test(amostra) && amostra.split(';').length < 2 && amostra.split('\t').length < 2) sep = ',';
    let rows = lin.map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')));
    if (rows.length && rows[0].every(c => /^\s*$/.test(c))) rows.shift();
    const temCab = rows.length && rows[0].filter(c => c !== '' && isNaN(numero(c))).length >= Math.ceil(rows[0].length / 2);
    const cab = temCab ? rows.shift() : rows[0].map((_, i) => 'Coluna ' + (i + 1));
    return { cab, rows, sep };
  }
  function numero(s) {
    if (s === undefined || s === null) return NaN;
    s = String(s).trim(); if (!s) return NaN;
    if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    return /^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s) ? parseFloat(s) : NaN;
  }
  function adivinharColunas(cab) {
    const m = {}, low = cab.map(c => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim());
    const acha = (re, excl) => low.findIndex((c, i) => re.test(c) && !(excl || []).includes(i));
    m.nome = acha(/^(nome|name|ponto|point|pt|id|vertice)\b/);
    m.codigo = acha(/^(code|codigo|cod|descri|desc|feature)/);
    m.e = acha(/^(e|este|east|easting|x|coord.?e|e\s*\(m\))$/);
    m.n = acha(/^(n|norte|north|northing|y|coord.?n|n\s*\(m\))$/);
    m.lat = acha(/^(lat|latitude|b)\b/);
    m.lon = acha(/^(lon|long|longitude|l)\b/);
    m.h = acha(/^(h|z|alt|altitude|elev|elevation|cota|ellips|altura.*elip|alt.*elip)/);
    m.sl = acha(/(sigma.?(e|lon|x)|sd.?e|std.?e|e.?rms|σ.?e)/);
    m.sb = acha(/(sigma.?(n|lat|y)|sd.?n|std.?n|n.?rms|σ.?n)/);
    m.hrms = acha(/^(hrms|h.?rms|prec.*h|horiz.*prec|precisao.?h|hprec)/);
    m.sh = acha(/(vrms|v.?rms|sigma.?(h|z|alt)|sd.?(h|z|u)|std.?(h|z|u)|prec.*v)/);
    m.sol = acha(/^(sol|solution|solucao|status|fix)/);
    return m;
  }

  G.GeoINCRA = {
    utmParaGeo, geoParaUtm, paraSGL, azimuteGeodesico, distGeocentrica, ecefParaGeo, resumo, lados, autoIntersecoes, dms, dmsTexto, azTexto, num, numBR,
    METODOS, LIMITES, PRECISAO, precisaoPosicional, limiteExigido, gerarCodigos, verificar, linhasSigef,
    lerZip, escreverZip, preencherOds, kml, lerTabela, numero, adivinharColunas, areaAssinada, esc
  };
})(typeof window !== 'undefined' ? window : globalThis);
