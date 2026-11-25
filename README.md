# Georref INCRA

App offline (PWA) para a rotina de georreferenciamento de imóveis rurais **antes do envio ao SIGEF**.

## O que faz
1. **Importa pontos RTK** (CSV/TXT da SingularPad ou de outra coletora): UTM SIRGAS 2000 ou geográficas, com colunas reconhecidas automaticamente e filtro por código (ex.: só os pontos `DIV`).
2. **Codifica os vértices** no padrão SIGEF: `CRED-M-0001`, `CRED-P-0001`, `CRED-V-0001`, com numeração contínua por tipo.
3. **Verifica a Norma Técnica** (NTGIR 3ª ed. / Manual Técnico):
   - precisão posicional √(σlat² + σlong²) ≤ 0,50 m (limite artificial) ou 3,00 m (limite natural). Vale o limite mais rigoroso dos dois lados do vértice;
   - método de posicionamento × tipo de vértice (M/P/V) e × tipo de limite (PG5/PG8 só em LN);
   - confrontantes, códigos repetidos, sentido horário, autointerseção, vértices coincidentes, solução Float.
4. **Gera as peças**:
   - planilha **ODS oficial do SIGEF** preenchida (aba `perimetro_1`, a partir da linha 12);
   - linhas para colar em A12, TXT, KML, CSV;
   - prévia do memorial descritivo (área, perímetro, azimutes e distâncias calculados no SGL).

O envio ao SIGEF e a assinatura continuam sendo feitos pelo credenciado no portal, com login gov.br e certificado digital.

## Publicar no GitHub Pages
1. Repositório: `rubinssp/rubinssp-georref-incra` (público).
2. **Add file → Upload files** → envie `index.html`, `core.js`, `sw.js`, `manifest.json`, `icon.svg` e `README.md`.
3. **Settings → Pages → Branch: main / (root) → Save**.
4. Acesse `https://rubinssp.github.io/rubinssp-georref-incra/` e instale pelo navegador (“Instalar app” / “Adicionar à tela inicial”).

## Limitações
- Um perímetro por projeto (sem áreas encravadas / perímetros internos).
- A sobreposição com parcelas vizinhas só é verificada pelo próprio SIGEF.
- Testado com o modelo oficial `sigef_planilha_modelo_1.2_rc5.ods`. Confira a planilha no LibreOffice antes de enviar: o modelo do SIGEF pode mudar de versão.
