# Sala | Giaco — Dashboard de Tráfego

Dashboard ao vivo do funil **Sala do Conselho (Giacobelli)**, com **2 funis numa dash só**:

- **SALA LP** — tráfego Meta da landing page × leads da LP (atribuição por UTM)
- **SALA FORM5** — tráfego Meta do form nativo × leads do form nativo (join direto)

Os dois usam o **mesmo Leadscore A–E** (4 perguntas, +1 por critério atendido):
Cargo de conselheiro · Conhece Conselho Consultivo · Já dá conselho de graça · Deseja ser conselheiro.
**Nota:** 4→A · 3→B · 2→C · 1→D · 0→E. **Qualificado = A+B.**

## Como funciona
- `build.ps1` baixa **4 planilhas** Google (gviz CSV, somente leitura), cruza queries × leads dos 2 funis,
  aplica o leadscore e o **imposto Meta ×1,1385** em todo gasto, e escreve `data.js` (`window.SALA`).
- Página estática (`index.html` + `app.js` + `styles.css`) lê o global e renderiza tudo em SVG puro (sem libs).
- **Atualização a cada 3h** via GitHub Actions (`refresh.yml`), disparado por cron-job.org (`workflow_dispatch`).

Dados publicados são **agregados/anonimizados**; os CSVs com PII ficam em `data/` (gitignore) e nunca vão pro Pages.
