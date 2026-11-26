/* Georref INCRA — leitura de matrícula (PDF digital, PDF escaneado ou imagem)
   Texto: pdf.js (PDF com texto) ou Tesseract.js (OCR em português). As bibliotecas são
   carregadas na primeira utilização e ficam guardadas pelo navegador para uso offline. */
(function (W) {
  'use strict';
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/';
  const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  // ---------------------------------------------------------------- leitura
  let pdfjs = null, tessWorker = null;
  async function carregarPdfjs() {
    if (pdfjs) return pdfjs;
    pdfjs = await import(PDFJS + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
    return pdfjs;
  }
  function carregarScript(src) {
    return new Promise((ok, falha) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => falha(new Error('Não foi possível carregar ' + src + ' (sem internet na primeira vez?)')); document.head.appendChild(s); });
  }
  async function ocr(img, progresso, rotulo) {
    if (!W.Tesseract) await carregarScript(TESS);
    if (!tessWorker) {
      progresso && progresso('Preparando o reconhecimento de texto (OCR)… na primeira vez baixa ~15 MB');
      tessWorker = await W.Tesseract.createWorker('por', 1, {
        logger: m => { if (progresso && m.status === 'recognizing text') progresso(`${rotulo}: lendo texto ${Math.round(m.progress * 100)}%`); }
      });
      await tessWorker.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' });
    }
    const r = await tessWorker.recognize(img);
    return r.data.text;
  }

  async function lerPdf(file, progresso) {
    const lib = await carregarPdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const partes = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i), rot = `${file.name} — pág. ${i}/${doc.numPages}`;
      progresso && progresso(rot + ': extraindo texto');
      const tc = await pg.getTextContent();
      let txt = '', ultY = null;
      tc.items.forEach(it => { const y = it.transform[5]; if (ultY !== null && Math.abs(y - ultY) > 3) txt += '\n'; else if (txt && !txt.endsWith(' ')) txt += ' '; txt += it.str; ultY = y; });
      if (txt.replace(/\s/g, '').length > 150) { partes.push(txt); continue; }
      // página escaneada: renderiza e faz OCR
      const vp = pg.getViewport({ scale: 2.8 });
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      partes.push(await ocr(cv, progresso, rot));
    }
    return { texto: partes.join('\n'), ocr: partes.some(Boolean) };
  }

  async function lerArquivos(files, progresso) {
    const lista = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    const textos = [];
    for (const f of lista) {
      if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) textos.push((await lerPdf(f, progresso)).texto);
      else if (/^image\//.test(f.type) || /\.(jpe?g|png|webp|bmp|tiff?)$/i.test(f.name)) textos.push(await ocr(f, progresso, f.name));
      else if (/^text\//.test(f.type) || /\.txt$/i.test(f.name)) textos.push(await f.text());
      else throw new Error(`Formato não suportado: ${f.name}`);
    }
    return textos.join('\n');
  }

  // ------------------------------------------------------------- extração
  const MAIUS = 'A-ZÀ-ÖØ-Ý';
  const NOME_RE = new RegExp(`[${MAIUS}]{2,}(?:\\s+(?:(?:DE|DA|DO|DOS|DAS|E|D')\\s+)?[${MAIUS}][${MAIUS}']+)+`, 'g');
  const CPF_RE = /(\d{3}[.\s]?\d{3}[.\s]?\d{3}\s?-\s?\d{2})/;
  const CNPJ_RE = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;

  function limpar(t) {
    return t.replace(/\r/g, '').replace(/[|“”"]/g, ' ').replace(/m\?/g, 'm²').replace(/m2\b/g, 'm²')
      .replace(/[ \t]+/g, ' ');
  }
  // remove o "lixo" de margem que o OCR junta no começo das linhas (texto vertical, carimbos)
  const PALAVRAS_CURTAS = new Set(['e', 'a', 'o', 'à', 'é', 'ao', 'as', 'os', 'de', 'da', 'do', 'em', 'no', 'na', 'um', 'se', 'ou', 'que', 'por', 'com', 'sua', 'seu', 'dos', 'das', 'aos', 'nas', 'nos', 'uma', 'R$']);
  function tirarMargem(t) {
    const linhas = t.split('\n'), longas = linhas.filter(l => l.trim().length > 40);
    const lixo = l => { const m = l.match(/^\s*(\S{1,3})\s+(?=\S)/); return m && !PALAVRAS_CURTAS.has(m[1]) && !/^\d{2,}[.,)]?$|^\d[.,)]$/.test(m[1]) || (m && /[|\]\[(){}=£€«»“”+*~]/.test(m[1])) ? m[0] : null; };
    if (longas.length < 5 || longas.filter(lixo).length / longas.length < 0.3) return t;
    return linhas.map(l => { if (l.trim().length <= 40) return l; let x = l, k = 0, r; while (k++ < 2 && (r = lixo(x))) x = x.slice(r.length); return x; }).join('\n');
  }
  function linhaUnica(t) { return t.replace(/-\n(?=[a-zà-ÿ])/g, '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' '); }
  function titulo(s) {
    const min = ['de', 'da', 'do', 'dos', 'das', 'e'];
    return s.toLowerCase().split(/\s+/).map((w, i) => i && min.includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  function fmtCpf(s) { const d = s.replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : s; }
  function cpfValido(c) {
    const d = c.replace(/\D/g, ''); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const dv = k => { let s = 0; for (let i = 0; i < k; i++) s += +d[i] * (k + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === +d[9] && dv(10) === +d[10];
  }
  function corrigeOcr(s) { return s.replace(/Sotumo/g, 'Soturno').replace(/Femando/g, 'Fernando'); }
  function trecho(txt, idx, len) { const a = Math.max(0, idx - 60), b = Math.min(txt.length, idx + (len || 0) + 60); return (a ? '…' : '') + txt.slice(a, b).trim() + (b < txt.length ? '…' : ''); }

  function extrair(bruto) {
    const t = corrigeOcr(linhaUnica(tirarMargem(limpar(bruto))));
    const campos = [], alertas = [];
    const add = (chave, rotulo, valor, idx, len, marcado = true) => { if (valor) campos.push({ chave, rotulo, valor, trecho: idx >= 0 ? trecho(t, idx, len) : '', marcado }); };

    // matrícula e CNS pelo CNM (Código Nacional de Matrícula: CNS.livro.matrícula-DV)
    let m = t.match(/CNM:?\s*(\d{6})\s*\.\s*(\d)\s*\.\s*(\d{7})\s*-?\s*(\d{2})/);
    let mat = '', cns = '';
    if (m) {
      cns = `${m[1].slice(0, 2)}.${m[1].slice(2, 5)}-${m[1].slice(5)}`; mat = String(+m[3]);
      add('cns', 'CNS do cartório', cns, m.index, m[0].length);
      add('mat', 'Matrícula', mat, m.index, m[0].length);
    }
    if (!mat) {
      m = t.match(/matr[ií]cula\s*(?:n[º°o.]*\s*)?(\d{1,3}(?:\.\d{3})+|\d{3,7})/i);
      if (m) add('mat', 'Matrícula', m[1].replace(/\./g, ''), m.index, m[0].length);
    }
    if (!cns) { m = t.match(/CNS:?\s*(\d{2}\.?\d{3}-?\d)/i); if (m) add('cns', 'CNS do cartório', m[1], m.index, m[0].length); }

    // código INCRA (SNCR)
    m = t.match(/(?:INCRA|SNCR|C[óo]digo do im[óo]vel)[^0-9]{0,25}(\d{3}\.\d{3}\.\d{3}\.\d{3}-\d)/i) || t.match(/(\d{3}\.\d{3}\.\d{3}\.\d{3}-\d)/);
    if (m) add('sncr', 'Código do imóvel (SNCR)', m[1], m.index, m[0].length);

    // município / UF
    m = t.match(/(?:neste|no|do)\s+munic[íi]pio\s+de\s+([A-ZÀ-Ý][\wÀ-ÿ' ]+?)\s*[-–\/]\s*([A-Z]{2})\b/);
    if (m) { add('mun', 'Município', m[1].trim(), m.index, m[0].length); add('uf', 'UF', m[2], m.index, m[0].length); }
    else { m = t.match(/Comarca de\s+([A-ZÀ-Ý][\wÀ-ÿ' ]+?)(?=\s+(?:Of[íi]cio|Estado|Livro|LIVRO|OF[ÍI]CIO)|[,.;])/i); if (m) add('mun', 'Município', titulo(m[1].trim()), m.index, m[0].length); }

    // denominação / localidade
    m = t.match(/Denomina[çc][ãa]o do im[óo]vel:\s*([^;.]+)/i);
    const loc = t.match(/sit[ao]s?\s+(?:em|no|na|ao|à)\s+(?:local denominado\s+)?([^,;]+?),\s+(?:neste|no|na|munic)/i);
    if (m && !/sem denomina/i.test(m[1])) add('denom', 'Denominação', m[1].trim(), m.index, m[0].length);
    else if (loc) add('denom', 'Denominação (localidade)', loc[1].trim(), loc.index, loc[0].length, false);

    // área
    m = t.match(/[áàâa]rea\s+(?:superficial|total)\s+de[^()]{0,200}?\(?\s*(?<![\d.,])(\d{1,3}(?:\.\d{3})*,\d{2})\s*m²/i) || t.match(/(?<![\d.,])(\d{1,3}(?:\.\d{3})*,\d{2})\s*m²/);
    let areaM2 = null;
    if (m) { areaM2 = +m[1].replace(/\./g, '').replace(',', '.'); add('area', 'Área da matrícula (para comparar)', `${m[1]} m² (${(areaM2 / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 4 })} ha)`, m.index, m[0].length); }
    else { m = t.match(/(\d+,\d{2,4})\s*(?:ha|hectares)/i); if (m) { areaM2 = +m[1].replace(',', '.') * 10000; add('area', 'Área da matrícula (para comparar)', m[1] + ' ha', m.index, m[0].length); } }

    // pessoas: nomes em maiúsculas seguidos de CPF/CNPJ
    const pessoas = [], vistos = new Set();
    const reDoc = new RegExp(`(?:CPF|CNPJ)(?:/MF)?\\s*(?:n[º°o.]*\\s*|sob o n[º°o.]*\\s*)?(${CPF_RE.source}|${CNPJ_RE.source})`, 'gi');
    let d;
    while ((d = reDoc.exec(t))) {
      const doc = d[1].replace(/\s/g, ''), antes = t.slice(Math.max(0, d.index - 320), d.index);
      const nomes = antes.match(NOME_RE) || [];
      let nome = nomes.filter(n => !/^(CPF|RG|CNPJ|SSP|SJS|IGP|RS|INCRA|CCIR|NIRF|LIVRO|ITR|CAR)\b/.test(n) && n.replace(/[^A-ZÀ-Ý]/g, '').length >= 6).pop();
      if (!nome) { const det = antes.match(/detentor:\s*([A-ZÀ-Ý][\wÀ-ÿ ]+?),/i); if (det) nome = det[1]; }
      if (!nome) continue;
      nome = titulo(nome.trim());
      const chave = doc.replace(/\D/g, '');
      if (vistos.has(chave)) continue; vistos.add(chave);
      pessoas.push({ nome, doc: doc.length >= 14 && /\//.test(doc) ? doc : fmtCpf(doc), cpfOk: doc.replace(/\D/g, '').length === 11 ? cpfValido(doc) : true, idx: d.index });
    }
    pessoas.forEach(p => { if (!p.cpfOk) alertas.push(`CPF de ${p.nome} (${p.doc}) não confere no dígito verificador — pode ser erro de leitura.`); });
    const det = t.match(/detentor:\s*([A-ZÀ-Ý][\wÀ-ÿ ]+?),[^;]{0,80}?CPF\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
    let principal = pessoas[0];
    if (det) principal = pessoas.find(p => p.doc.replace(/\D/g, '') === det[2].replace(/\D/g, '')) || { nome: titulo(det[1]), doc: fmtCpf(det[2]) };

    // confrontações
    let confrontacoes = '', confrontantes = [];
    m = t.match(/confronta(?:ndo|-se|ções|coes)[^:]{0,15}:?\s*(.+?)(?=\s(?:INCRA|PROPRIET[ÁA]RIO|CADASTRO|CCIR|NIRF|Cadastrado|Registro anterior|PROCED[ÊE]NCIA|R[-.]\s?\d)\b|$)/i);
    if (m) {
      confrontacoes = m[1].trim().slice(0, 1500);
      const partes = confrontacoes.split(/;\s*(?:e,?\s*)?|\.\s+(?=ao\s)/i);
      partes.forEach(p => {
        const lado = (p.match(/\b(NORTE|SUL|LESTE|OESTE|NORDESTE|NOROESTE|SUDESTE|SUDOESTE|FRENTE|FUNDOS)\b/i) || [])[1] || '';
        let nome = (p.match(/hoje\s+(?:\S{1,3}\s+)?(.+)$/i) || p.match(/com\s+(?:terras|im[óo]vel|propriedade)\s+(?:de|do|da|dos|das)\s+(.+)$/i) || p.match(/com\s+(.+)$/i) || [])[1];
        if (!nome) return;
        nome = nome.replace(/(?:\s+\S{1,2})?[.,;\s]*$/, '').replace(/^(?:de|da|do|dos|das|com)\s+/i, '').trim();
        nome.split(/\s+e\s+(?=[A-ZÀ-Ý])/).forEach(n => { n = n.trim(); if (n.length >= 3) confrontantes.push({ lado: lado.toUpperCase(), nome: n }); });
      });
    }

    // registros posteriores que podem ter mudado a titularidade
    const regs = t.match(/\b(?:R|AV)\s?[-.]\s?\d{1,3}\s?[-\/]\s?\d[\d.]*/g) || [];
    if (/\b(compra e venda|transmitente|adquirente|doa[çc][ãa]o|partilha|formal de partilha|usufruto|arremata[çc][ãa]o|permuta)\b/i.test(t))
      alertas.push('A matrícula tem registro de transmissão (compra e venda, doação, partilha…): confira quem é o proprietário ATUAL antes de aplicar.');
    if (regs.length) alertas.push(`Registros/averbações encontrados: ${[...new Set(regs.map(r => r.replace(/\s/g, '')))].slice(0, 12).join(', ')}.`);
    if (pessoas.length > 2) alertas.push(`A matrícula cita ${pessoas.length} pessoas com CPF/CNPJ — escolha abaixo quem vai como detentor na planilha.`);

    if (principal) {
      add('nome', 'Proprietário/detentor', principal.nome, principal.idx ?? -1, 0);
      add('cpf', 'CPF/CNPJ', principal.doc, principal.idx ?? -1, 0);
      if (/\//.test(principal.doc)) add('pessoa', 'Tipo de pessoa', 'Jurídica', -1, 0);
    }
    add('sit', 'Situação', 'Imóvel Registrado', -1, 0);

    return { texto: t, campos, pessoas, principal, confrontacoes, confrontantes, alertas, areaM2 };
  }

  W.GeoMatricula = { lerArquivos, extrair, cpfValido };
})(typeof window !== 'undefined' ? window : globalThis);
