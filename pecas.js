/* Georref INCRA — peças técnicas preliminares (planta e memorial no leiaute do SIGEF)
   Documentos de PRÉVIA para apresentação ao cliente: não substituem as peças certificadas. */
(function (W) {
  'use strict';
  const G = W.GeoINCRA, e = G.esc;
  const hoje = () => new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const AVISO = 'PRÉVIA PARA CONFERÊNCIA — documento preliminar, sem certificação no SIGEF/INCRA';

  function confrontante(v) { return [v.conf, v.cns ? 'CNS: ' + v.cns : '', v.mat ? 'Mat. ' + v.mat : ''].filter(Boolean).join(' | '); }
  function docFmt(c) { const d = (c || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : (c || ''); }
  function municipioUF(p) { return (p.mun || '') + (p.uf ? '-' + p.uf.toUpperCase() : ''); }

  function dadosCabecalho(p, r) {
    return [
      ['Denominação', p.denom], ['Proprietário', p.nome], ['Matrícula do imóvel', p.mat], ['Natureza da área', p.natarea || 'Particular'],
      [/jur/i.test(p.pessoa || '') ? 'CNPJ' : 'CPF', docFmt(p.cpf)], ['Código INCRA/SNCR', p.sncr], ['Município/UF', municipioUF(p)], ['Natureza do serviço', p.natserv || 'Particular'],
      ['Responsável técnico', p.rt], ['Formação', p.crea], ['Código de credenciamento', p.cred && p.cred !== 'XXXX' ? p.cred : ''], ['Documento de RT', p.art],
      ['Área (Sistema Geodésico Local)', G.numBR(r.area / 10000, 4) + ' ha'], ['Perímetro (m)', G.numBR(r.perimetro, 2) + ' m']
    ];
  }

  const CSS_BASE = `*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000;background:#888}
  .barra{position:sticky;top:0;background:#1f4d3a;color:#fff;padding:8px 14px;font:14px system-ui;display:flex;gap:12px;align-items:center;z-index:5}
  .barra button{font:inherit;padding:5px 12px;border:0;border-radius:4px;cursor:pointer}
  @media print{.barra{display:none}body{background:#fff}}`;

  // ----------------------------- MEMORIAL -----------------------------
  function memorial(S) {
    const p = S.proj, vs = S.vs, L = G.lados(vs), r = G.resumo(vs), dc = +p.decc || 3;
    const cab = dadosCabecalho(p, r);
    const gs = v => (v < 0 ? '-' : '') + G.dmsTexto(v, dc, 'E', 'W').replace(/ [EWNS]$/, '');
    const linhas = vs.map((v, i) => {
      const w = vs[(i + 1) % vs.length];
      return `<tr><td>${e(v.codigo)}</td><td>${gs(v.lon)}</td><td>${gs(v.lat)}</td><td class="n">${G.num(v.h || 0, 2)}</td>
      <td>${e(w.codigo)}</td><td>${G.azTexto(L[i].az)}</td><td class="n">${G.num(L[i].dist, 2)}</td><td class="conf">${e(confrontante(v))}</td></tr>`;
    }).join('');
    const co = v => `Longitude: ${gs(v.lon)}, Latitude: ${gs(v.lat)} e Altitude: ${G.num(v.h || 0, 2)} m`;
    let desc = `Inicia-se a descrição deste perímetro no vértice <b>${e(vs[0].codigo)}</b>, de coordenadas (${co(vs[0])}); `;
    vs.forEach((v, i) => {
      const w = vs[(i + 1) % vs.length], ult = i === vs.length - 1;
      desc += `deste, segue confrontando com ${e(confrontante(v))}, com os seguintes azimute e distância: ${G.azTexto(L[i].az)} e ${G.num(L[i].dist, 2)} m até o vértice <b>${e(w.codigo)}</b>` +
        (ult ? ', ponto inicial da descrição deste perímetro.' : `, de coordenadas (${co(w)}); `);
    });
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Memorial descritivo (prévia) – ${e(p.denom || '')}</title><style>${CSS_BASE}
    @page{size:A4 portrait;margin:14mm 12mm}
    .folha{background:#fff;width:210mm;min-height:297mm;margin:12px auto;padding:14mm 12mm;position:relative}
    @media print{.folha{margin:0;width:auto;min-height:0;padding:0}}
    .prev{border:1.5px solid #b00;color:#b00;text-align:center;font-weight:bold;font-size:9pt;padding:3px;margin-bottom:8px}
    h1{text-align:center;font-size:13pt;margin:4px 0 10px;letter-spacing:.5px}
    table{border-collapse:collapse;width:100%;font-size:8pt}
    .cab td{border:1px solid #000;padding:3px 5px;vertical-align:top;width:25%}.cab b{display:block;font-size:7pt;color:#333;font-weight:normal}
    .vt{margin-top:10px}.vt th,.vt td{border:1px solid #000;padding:2px 3px;text-align:center}.vt th{background:#e6e6e6;font-size:7.5pt}
    .vt td.conf{text-align:left;font-size:7.5pt}.vt td.n{text-align:right}
    .vt thead{display:table-header-group}.vt tr{page-break-inside:avoid}
    .txt{font-size:9pt;text-align:justify;line-height:1.45;margin-top:12px}
    .ass{margin-top:40px;display:flex;justify-content:space-around;font-size:8.5pt;text-align:center}.ass div{width:42%;border-top:1px solid #000;padding-top:3px}
    </style></head><body>
    <div class="barra"><b>Memorial descritivo — prévia</b><button onclick="print()">Imprimir / salvar PDF</button><span>No diálogo de impressão, escolha “Salvar como PDF”.</span></div>
    <div class="folha"><div class="prev">${AVISO}</div>
    <h1>MEMORIAL DESCRITIVO</h1>
    <table class="cab">${[0, 4, 8, 12].map(k => '<tr>' + cab.slice(k, k + 4).map(([t, v]) => `<td><b>${t}</b>${e(v || '—')}</td>`).join('') + '</tr>').join('')}</table>
    <table class="vt"><thead><tr><th colspan="4">VÉRTICE</th><th colspan="4">SEGMENTO VANTE</th></tr>
    <tr><th>Código</th><th>Longitude</th><th>Latitude</th><th>Altitude (m)</th><th>Código</th><th>Azimute</th><th>Dist. (m)</th><th>Confrontações</th></tr></thead><tbody>${linhas}</tbody></table>
    <div class="txt"><p>${desc}</p>
    <p>Todas as coordenadas aqui descritas estão georreferenciadas ao Sistema Geodésico Brasileiro${p.base ? ', ' + e(p.base) : ''}, e encontram-se representadas no Sistema de Coordenadas Geodésicas SIRGAS 2000 (longitude e latitude a oeste de Greenwich e ao sul do Equador). Todos os azimutes foram calculados pela fórmula do Problema Geodésico Inverso. Perímetro e distâncias foram calculados pelas coordenadas cartesianas geocêntricas. A área foi calculada pelas coordenadas cartesianas locais referenciadas ao Sistema Geodésico Local (SGL), com origem na média das coordenadas cartesianas geocêntricas dos vértices.</p>
    <p style="text-align:right">${e(p.mun || '')}${p.mun ? ', ' : ''}${hoje()}.</p></div>
    <div class="ass"><div>${e(p.rt || 'Responsável técnico')}<br>${e(p.crea || '')}</div><div>${e(p.nome || 'Proprietário')}<br>${e(p.cpf ? (/jur/i.test(p.pessoa || '') ? 'CNPJ ' : 'CPF ') + docFmt(p.cpf) : '')}</div></div>
    </div></body></html>`;
  }

  // ------------------------------ PLANTA ------------------------------
  const ESCALAS = [250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 10000, 12500, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000];
  const PASSOS_SEG = [1, 2, 3, 5, 10, 15, 20, 30, 60, 120, 180, 300, 600, 900, 1800, 3600];

  function gms(v, eixo) {
    const neg = v < 0; let x = Math.abs(v), g = Math.floor(x), m = Math.floor((x - g) * 60), s = Math.round(((x - g) * 60 - m) * 60);
    if (s === 60) { s = 0; m++; } if (m === 60) { m = 0; g++; }
    return `${neg ? '-' : ''}${g}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
  }

  function planta(S, papel) {
    const p = S.proj, vs = S.vs, r = G.resumo(vs);
    const fuso = +p.fuso || Math.floor((vs[0].lon + 180) / 6) + 1, hem = p.hem || 'S';
    const A3 = papel !== 'A4';
    const PW = A3 ? 420 : 297, PH = A3 ? 297 : 210, M = 10, PAINEL = A3 ? 112 : 92;
    const mapa = { x: M, y: M, w: PW - 2 * M - PAINEL - 4, h: PH - 2 * M };
    const u = vs.map(v => G.geoParaUtm(v.lat, v.lon, fuso, hem));
    const minE = Math.min(...u.map(q => q.E)), maxE = Math.max(...u.map(q => q.E)), minN = Math.min(...u.map(q => q.N)), maxN = Math.max(...u.map(q => q.N));
    const dE = maxE - minE || 1, dN = maxN - minN || 1;
    // escala: o polígono deve ocupar no máximo ~72% da moldura (sobra para rótulos)
    const util = 0.72, esc = ESCALAS.find(s => dE * 1000 / s <= mapa.w * util && dN * 1000 / s <= mapa.h * util) || ESCALAS[ESCALAS.length - 1];
    const k = 1000 / esc; // mm por metro
    const cE = (minE + maxE) / 2, cN = (minN + maxN) / 2, cx = mapa.x + mapa.w / 2, cy = mapa.y + mapa.h / 2;
    const X = E => cx + (E - cE) * k, Y = N => cy - (N - cN) * k;
    const pts = u.map(q => ({ x: X(q.E), y: Y(q.N) }));
    const gx = pts.reduce((t, q) => t + q.x, 0) / pts.length, gy = pts.reduce((t, q) => t + q.y, 0) / pts.length;
    const fs = A3 ? 2.3 : 2.0;
    let svg = '';

    // grade geográfica
    const cantos = [[mapa.x, mapa.y], [mapa.x + mapa.w, mapa.y], [mapa.x, mapa.y + mapa.h], [mapa.x + mapa.w, mapa.y + mapa.h]]
      .map(([x, y]) => G.utmParaGeo(cE + (x - cx) / k, cN - (y - cy) / k, fuso, hem));
    const latMin = Math.min(...cantos.map(c => c.lat)), latMax = Math.max(...cantos.map(c => c.lat));
    const lonMin = Math.min(...cantos.map(c => c.lon)), lonMax = Math.max(...cantos.map(c => c.lon));
    const passo = (PASSOS_SEG.find(s => (latMax - latMin) * 3600 / s <= 5) || 3600) / 3600;
    svg += `<defs><clipPath id="cm"><rect x="${mapa.x}" y="${mapa.y}" width="${mapa.w}" height="${mapa.h}"/></clipPath></defs><g clip-path="url(#cm)" stroke="#9a9a9a" stroke-width="0.15" fill="none">`;
    const rotGrade = [];
    for (let la = Math.ceil(latMin / passo) * passo; la <= latMax; la += passo) {
      const a = G.geoParaUtm(la, lonMin - passo, fuso, hem), b = G.geoParaUtm(la, lonMax + passo, fuso, hem);
      svg += `<line x1="${X(a.E)}" y1="${Y(a.N)}" x2="${X(b.E)}" y2="${Y(b.N)}"/>`;
      const yl = Y(a.N) + (Y(b.N) - Y(a.N)) * (mapa.x - X(a.E)) / (X(b.E) - X(a.E));
      if (yl > mapa.y + 4 && yl < mapa.y + mapa.h - 4) rotGrade.push(`<text x="${mapa.x + 1}" y="${yl - 0.8}" font-size="${fs * 0.8}" fill="#555">${gms(la)}</text>`);
    }
    for (let lo = Math.ceil(lonMin / passo) * passo; lo <= lonMax; lo += passo) {
      const a = G.geoParaUtm(latMin - passo, lo, fuso, hem), b = G.geoParaUtm(latMax + passo, lo, fuso, hem);
      svg += `<line x1="${X(a.E)}" y1="${Y(a.N)}" x2="${X(b.E)}" y2="${Y(b.N)}"/>`;
      const xl = X(a.E) + (X(b.E) - X(a.E)) * (mapa.y + mapa.h - Y(a.N)) / (Y(b.N) - Y(a.N));
      if (xl > mapa.x + 8 && xl < mapa.x + mapa.w - 8) rotGrade.push(`<text x="${xl}" y="${mapa.y + mapa.h - 1.2}" font-size="${fs * 0.8}" fill="#555" text-anchor="middle">${gms(lo)}</text>`);
    }
    svg += `</g>${rotGrade.join('')}`;

    // polígono
    svg += `<polygon points="${pts.map(q => q.x.toFixed(2) + ',' + q.y.toFixed(2)).join(' ')}" fill="#e9f3ec" stroke="none"/>`;
    pts.forEach((q, i) => {
      const w = pts[(i + 1) % pts.length], nat = (vs[i].limite || '').startsWith('LN');
      svg += `<line x1="${q.x}" y1="${q.y}" x2="${w.x}" y2="${w.y}" stroke="${nat ? '#1f5fa8' : '#c0392b'}" stroke-width="0.45"/>`;
    });

    // confrontantes: um rótulo por trecho contínuo com o mesmo confrontante
    const n = vs.length, grupos = [];
    let ini = 0;
    while (ini < n && confrontante(vs[ini]) === confrontante(vs[(ini - 1 + n) % n])) { ini++; if (ini === n) { ini = 0; break; } }
    for (let c = 0; c < n;) {
      const i0 = (ini + c) % n, nome = confrontante(vs[i0]); let len = 0, idx = [];
      while (c < n && confrontante(vs[(ini + c) % n]) === nome) { idx.push((ini + c) % n); c++; }
      grupos.push({ nome, idx });
    }
    // caixas ocupadas (rótulos e símbolos dos vértices) para evitar sobreposição
    const caixas = [];
    const caixaRot = (cx0, cy0, w, h, angDeg) => { const t = angDeg * Math.PI / 180, c = Math.abs(Math.cos(t)), s2 = Math.abs(Math.sin(t)); const W2 = (w * c + h * s2) / 2, H2 = (w * s2 + h * c) / 2; return [cx0 - W2, cy0 - H2, cx0 + W2, cy0 + H2]; };
    const colide = bx => caixas.some(c => bx[0] < c[2] && bx[2] > c[0] && bx[1] < c[3] && bx[3] > c[1]) || bx[0] < mapa.x || bx[2] > mapa.x + mapa.w || bx[1] < mapa.y + 7 || bx[3] > mapa.y + mapa.h - 18;
    const rotV = pts.map((q, i) => {
      let dx = q.x - gx, dy = q.y - gy; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const t = vs[i].codigo || vs[i].nome, w = t.length * fs * 0.9 * 0.55, h = fs * 0.9 * 1.1;
      const tx = q.x + dx * fs * 1.6, ty = q.y + dy * fs * 1.6, anc = dx > 0.3 ? 'start' : dx < -0.3 ? 'end' : 'middle';
      const x0 = anc === 'start' ? tx : anc === 'end' ? tx - w : tx - w / 2;
      caixas.push([x0, ty - h / 2, x0 + w, ty + h / 2], [q.x - fs * 0.7, q.y - fs * 0.7, q.x + fs * 0.7, q.y + fs * 0.7]);
      return { tx, ty, anc, t };
    });
    // segmentos do polígono também contam como obstáculo (amostrados)
    const pontoNoLado = [];
    pts.forEach((q, i) => { const w = pts[(i + 1) % pts.length], L2 = Math.hypot(w.x - q.x, w.y - q.y), m = Math.ceil(L2 / 1.5); for (let j = 0; j <= m; j++) pontoNoLado.push([q.x + (w.x - q.x) * j / m, q.y + (w.y - q.y) * j / m]); });
    const cortaLado = (cx0, cy0, w, h, ang) => { const t = -ang * Math.PI / 180, c = Math.cos(t), s2 = Math.sin(t); return pontoNoLado.some(([x, y]) => { const dx = x - cx0, dy = y - cy0, u = dx * c - dy * s2, v = dx * s2 + dy * c; return Math.abs(u) < w / 2 && Math.abs(v) < h / 2; }); };
    const rotC = [];
    grupos.forEach(gp => {
      if (!gp.nome) return;
      const txt = gp.nome.length > 60 ? gp.nome.slice(0, 58) + '…' : gp.nome;
      const ladosOrd = gp.idx.map(i => { const a = pts[i], b = pts[(i + 1) % n]; return { i, a, b, l: Math.hypot(b.x - a.x, b.y - a.y) }; }).sort((x, y) => y.l - x.l);
      let feito = null;
      for (const fz of [fs, fs * 0.85, fs * 0.72]) {
        const w = txt.length * fz * 0.52, h = fz * 1.2;
        for (const ld of ladosOrd) {
          const { a, b } = ld;
          let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
          let nx = -(b.y - a.y), ny = b.x - a.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
          const mx0 = (a.x + b.x) / 2, my0 = (a.y + b.y) / 2;
          if ((mx0 - gx) * nx + (my0 - gy) * ny < 0) { nx = -nx; ny = -ny; }
          for (const fr of [0.5, 0.35, 0.65, 0.2, 0.8, 0, 1]) for (const off of [1.6, 2.6, 4, 6, 8.5, 11, 14, 18]) {
            const mx = a.x + (b.x - a.x) * fr, my = a.y + (b.y - a.y) * fr;
            const tx = mx + nx * fz * off, ty = my + ny * fz * off, bx = caixaRot(tx, ty, w, h, ang);
            if (!colide(bx) && !cortaLado(tx, ty, w, h, ang)) { feito = { tx, ty, ang, fz, bx, mx, my, off, nx, ny }; break; }
          }
          if (feito) break;
        }
        if (feito) break;
      }
      if (!feito) { // último recurso: no meio do lado mais longo, afastado
        const { a, b } = ladosOrd[0]; let ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        let nx = -(b.y - a.y), ny = b.x - a.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; if ((mx - gx) * nx + (my - gy) * ny < 0) { nx = -nx; ny = -ny; }
        feito = { tx: mx + nx * fs * 5, ty: my + ny * fs * 5, ang, fz: fs * 0.72, bx: null };
      }
      if (feito.bx) caixas.push(feito.bx);
      if (feito.off >= 6) rotC.push(`<line x1="${feito.mx.toFixed(2)}" y1="${feito.my.toFixed(2)}" x2="${(feito.tx - feito.nx * feito.fz * 0.9).toFixed(2)}" y2="${(feito.ty - feito.ny * feito.fz * 0.9).toFixed(2)}" stroke="#666" stroke-width="0.15" stroke-dasharray="0.8 0.5"/>`);
      rotC.push(`<text x="${feito.tx.toFixed(2)}" y="${feito.ty.toFixed(2)}" font-size="${feito.fz.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${feito.ang.toFixed(1)} ${feito.tx.toFixed(2)} ${feito.ty.toFixed(2)})" fill="#222" font-style="italic">${e(txt)}</text>`);
    });

    // vértices
    pts.forEach((q, i) => {
      const t = vs[i].tipo, s = fs * 0.55;
      if (t === 'M') svg += `<rect x="${q.x - s}" y="${q.y - s}" width="${2 * s}" height="${2 * s}" fill="#000"/>`;
      else if (t === 'V') svg += `<polygon points="${q.x},${q.y - s * 1.2} ${q.x + s * 1.1},${q.y + s * 0.8} ${q.x - s * 1.1},${q.y + s * 0.8}" fill="#fff" stroke="#000" stroke-width="0.25"/>`;
      else svg += `<circle cx="${q.x}" cy="${q.y}" r="${s}" fill="#fff" stroke="#000" stroke-width="0.3"/>`;
      const r0 = rotV[i];
      svg += `<text x="${r0.tx}" y="${r0.ty}" font-size="${fs * 0.9}" text-anchor="${r0.anc}" dominant-baseline="middle" fill="#000">${e(r0.t)}</text>`;
    });
    svg += rotC.join('');

    // moldura, norte e escala gráfica
    svg += `<rect x="${mapa.x}" y="${mapa.y}" width="${mapa.w}" height="${mapa.h}" fill="none" stroke="#000" stroke-width="0.5"/>`;
    const nx0 = mapa.x + mapa.w - 12, ny0 = mapa.y + 16;
    svg += `<g transform="translate(${nx0},${ny0})"><path d="M0,-10 L4,4 L0,1.5 Z" fill="#000"/><path d="M0,-10 L-4,4 L0,1.5 Z" fill="#fff" stroke="#000" stroke-width="0.3"/><text y="9" font-size="3.5" text-anchor="middle" font-weight="bold">N</text></g>`;
    const alvo = mapa.w * 0.25 / k, nice = [1, 2, 2.5, 5].flatMap(m => [1, 10, 100, 1000, 10000].map(z => m * z)).sort((x, y) => x - y);
    const seg = nice.filter(v => v <= alvo / 4).pop() || 1, bx = mapa.x + 16, by = mapa.y + mapa.h - 14;
    for (let s = 0; s < 4; s++) svg += `<rect x="${bx + s * seg * k}" y="${by}" width="${seg * k}" height="1.6" fill="${s % 2 ? '#fff' : '#000'}" stroke="#000" stroke-width="0.2"/>`;
    for (let s = 0; s <= 4; s++) svg += `<text x="${bx + s * seg * k}" y="${by - 1}" font-size="${fs * 0.8}" text-anchor="middle">${G.numBR(s * seg, 0)}</text>`;
    svg += `<text x="${bx + 4 * seg * k + 2}" y="${by + 1.5}" font-size="${fs * 0.8}">m</text>`;
    svg += `<text x="${mapa.x + mapa.w / 2}" y="${mapa.y + 5}" font-size="3" text-anchor="middle" fill="#b00" font-weight="bold">${AVISO}</text>`;

    // painel lateral
    const px = PW - M - PAINEL, py = M; let y = py;
    const blocos = [];
    const caixa = (h, conteudo) => { blocos.push(`<rect x="${px}" y="${y}" width="${PAINEL}" height="${h}" fill="#fff" stroke="#000" stroke-width="0.4"/>` + conteudo); y += h; };
    const tx = (x, yy, t, sz, extra) => `<text x="${x}" y="${yy}" font-size="${sz}" ${extra || ''}>${e(t)}</text>`;
    caixa(14, tx(px + PAINEL / 2, y + 6, 'PLANTA DO IMÓVEL', 4.2, 'text-anchor="middle" font-weight="bold"') + tx(px + PAINEL / 2, y + 11, 'prévia para conferência', 2.6, 'text-anchor="middle" fill="#b00"'));
    const campos = [['Denominação', p.denom], ['Proprietário', p.nome], [/jur/i.test(p.pessoa || '') ? 'CNPJ' : 'CPF', docFmt(p.cpf)], ['Matrícula', p.mat], ['Código INCRA/SNCR', p.sncr], ['Município/UF', municipioUF(p)], ['Natureza da área', p.natarea || 'Particular']];
    const cortar = (s, max) => (s || '—').length > max ? (s || '').slice(0, max - 1) + '…' : (s || '—');
    const maxc = Math.floor(PAINEL / 1.55);
    caixa(campos.length * 7.2 + 3, campos.map(([t, v], i) => tx(px + 2, y + 4 + i * 7.2, t, 2.1, 'fill="#444"') + tx(px + 2, y + 7.6 + i * 7.2, cortar(v, maxc), 2.8, 'font-weight="bold"')).join(''));
    caixa(19, tx(px + 2, y + 5, 'Área (SGL):', 2.6) + tx(px + PAINEL - 2, y + 5, G.numBR(r.area / 10000, 4) + ' ha', 3.4, 'text-anchor="end" font-weight="bold"') +
      tx(px + 2, y + 11, 'Perímetro:', 2.6) + tx(px + PAINEL - 2, y + 11, G.numBR(r.perimetro, 2) + ' m', 3.0, 'text-anchor="end" font-weight="bold"') +
      tx(px + 2, y + 16.5, `Escala 1:${G.numBR(esc, 0)} (${A3 ? 'A3' : 'A4'})  ·  SIRGAS 2000`, 2.4));
    // convenções
    const cv = y + 5;
    caixa(30, tx(px + 2, cv, 'CONVENÇÕES', 2.6, 'font-weight="bold"') +
      `<rect x="${px + 3}" y="${cv + 3}" width="2" height="2" fill="#000"/>` + tx(px + 8, cv + 4.8, 'Vértice tipo M (marco)', 2.3) +
      `<circle cx="${px + 4}" cy="${cv + 8.5}" r="1.1" fill="#fff" stroke="#000" stroke-width="0.3"/>` + tx(px + 8, cv + 9.3, 'Vértice tipo P (ponto)', 2.3) +
      `<polygon points="${px + 4},${cv + 11.8} ${px + 5.2},${cv + 14} ${px + 2.8},${cv + 14}" fill="#fff" stroke="#000" stroke-width="0.25"/>` + tx(px + 8, cv + 13.8, 'Vértice tipo V (virtual)', 2.3) +
      `<line x1="${px + 2}" y1="${cv + 17.5}" x2="${px + 6.5}" y2="${cv + 17.5}" stroke="#c0392b" stroke-width="0.6"/>` + tx(px + 8, cv + 18.3, 'Limite artificial (cerca, estrada...)', 2.3) +
      `<line x1="${px + 2}" y1="${cv + 22}" x2="${px + 6.5}" y2="${cv + 22}" stroke="#1f5fa8" stroke-width="0.6"/>` + tx(px + 8, cv + 22.8, 'Limite natural (curso d’água...)', 2.3));
    // carimbo do RT
    const rodapeH = 30, sobra = PH - M - rodapeH - y;
    // tabela de coordenadas, se couber
    const lh = 2.9, cab = 9, cabem = Math.floor((sobra - cab - 2) / lh);
    if (cabem >= 3) {
      const mostra = vs.slice(0, cabem), corta = vs.length > cabem;
      const hT = cab + mostra.length * lh + (corta ? lh : 0) + 2;
      const c1 = px + 2, c2 = px + PAINEL * 0.36, c3 = px + PAINEL * 0.70;
      caixa(hT, tx(px + 2, y + 4, 'VÉRTICES (SIRGAS 2000)', 2.4, 'font-weight="bold"') +
        tx(c1, y + 8, 'Código', 2.1, 'fill="#444"') + tx(c2, y + 8, 'Longitude', 2.1, 'fill="#444"') + tx(c3, y + 8, 'Latitude', 2.1, 'fill="#444"') +
        mostra.map((v, i) => { const yy = y + cab + 2 + i * lh; return tx(c1, yy, v.codigo || v.nome, 2.05) + tx(c2, yy, gms(v.lon), 2.05) + tx(c3, yy, gms(v.lat), 2.05); }).join('') +
        (corta ? tx(c1, y + cab + 2 + mostra.length * lh, `… e mais ${vs.length - cabem} vértices (ver memorial)`, 2.05, 'font-style="italic"') : ''));
    }
    y = PH - M - rodapeH;
    caixa(rodapeH, tx(px + 2, y + 4, 'Responsável técnico', 2.1, 'fill="#444"') + tx(px + 2, y + 8, cortar(p.rt, maxc), 2.8, 'font-weight="bold"') +
      tx(px + 2, y + 11.5, cortar([p.crea, p.cred && p.cred !== 'XXXX' ? 'Cód. INCRA ' + p.cred : '', p.art ? 'RT ' + p.art : ''].filter(Boolean).join(' · '), maxc + 8), 2.3) +
      `<line x1="${px + 10}" y1="${y + 22}" x2="${px + PAINEL - 10}" y2="${y + 22}" stroke="#000" stroke-width="0.25"/>` + tx(px + PAINEL / 2, y + 25, 'assinatura', 2.1, 'text-anchor="middle" fill="#444"') +
      tx(px + PAINEL - 2, y + 28.5, hoje(), 2.1, 'text-anchor="end" fill="#444"'));
    svg += blocos.join('');

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Planta (prévia) – ${e(p.denom || '')}</title><style>${CSS_BASE}
    @page{size:${A3 ? 'A3' : 'A4'} landscape;margin:0}
    .folha{background:#fff;width:${PW}mm;height:${PH}mm;margin:12px auto;box-shadow:0 2px 10px #0006}
    @media print{.folha{margin:0;box-shadow:none}}
    svg{display:block;width:${PW}mm;height:${PH}mm;font-family:Arial,Helvetica,sans-serif}
    </style></head><body>
    <div class="barra"><b>Planta — prévia</b><button onclick="print()">Imprimir / salvar PDF</button><span>Papel ${A3 ? 'A3' : 'A4'} paisagem, margens “nenhuma”.</span></div>
    <div class="folha"><svg viewBox="0 0 ${PW} ${PH}" xmlns="http://www.w3.org/2000/svg">${svg}</svg></div></body></html>`;
  }

  W.GeoPecas = { memorial, planta };
})(window);
