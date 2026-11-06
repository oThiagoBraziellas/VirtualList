# VirtualList

Lista com virtualização de janela (windowing) que renderiza 100.000 linhas, ou até 500.000, mantendo apenas algumas dezenas de elementos no DOM. Inclui busca com destaque, alturas fixas ou variáveis, "ir para a linha" com rolagem suave e navegação por teclado.

O cálculo de quais linhas aparecem está em um módulo puro (`src/windowing.js`), separado do DOM, e é bem testado.

## Por que este projeto

Tabelas de dados, feeds, logs e caixas de entrada precisam lidar com listas enormes sem travar o navegador. Criar 100 mil nós de DOM leva segundos e consome centenas de megabytes; a virtualização resolve isso e é uma pergunta clássica de entrevistas de front-end e de desempenho. O projeto mostra:

- a matemática de janelas: offsets, busca binária por posição, overscan, limites;
- como manter a barra de rolagem nativa (um "spacer" com a altura total) em vez de simular rolagem;
- reaproveitamento de nós por índice em vez de recriar tudo a cada quadro;
- acessibilidade em listas virtuais (`aria-posinset`, `aria-setsize`, `aria-activedescendant`), onde o DOM não contém todos os itens;
- trade-offs entre altura fixa (O(1)) e variável (soma de prefixos + busca binária, O(log n)).

## Recursos

- 10 mil, 50 mil, 100 mil ou 500 mil linhas geradas de forma determinística.
- Janela de renderização com overscan configurável; o painel mostra a faixa renderizada e o número de nós no DOM.
- Busca em nome, e-mail, cidade e observação, ignorando acentos e maiúsculas, com todos os termos obrigatórios e destaque dos trechos encontrados (sem `innerHTML`).
- Modo de alturas variáveis (linhas com observação longa ficam mais altas).
- "Ir para a linha N" com rolagem suave, respeitando `prefers-reduced-motion`.
- Teclado: setas, `PageUp`/`PageDown`, `Home` e `End` com linha ativa.
- Atualização por `requestAnimationFrame` e `ResizeObserver`.

## Como executar

Abra o `index.html` no navegador ou use um servidor local:

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

Se o navegador bloquear ES modules em `file://`, use o servidor local.

## Como testar

Dentro desta pasta, com Node 18 ou superior:

```bash
node --test
```

Os testes verificam a matemática de janelas com listas de 10.000 e 1.000.000 de itens: início, meio e fim, rolagem além do limite, linhas parciais, alinhamento do primeiro item renderizado em alturas variáveis, equivalência entre a busca binária e uma varredura linear, limite máximo de linhas renderizadas, navegação por teclado, além da busca, do destaque (com acentos) e do gerador de dados.

## Decisões de projeto

- **Spacer + posicionamento absoluto.** Um elemento com a altura total mantém a barra de rolagem e o comportamento nativo (inclusive rolagem por toque e inércia). Cada linha visível é posicionada em `top` calculado pelos offsets. A alternativa de transladar um bloco inteiro é mais simples, mas fica difícil de combinar com alturas variáveis.
- **Overscan.** Renderizar algumas linhas além da área visível evita faixas em branco durante rolagem rápida, ao custo de poucos nós extras (padrão: 6 acima e abaixo).
- **Alturas fixas versus variáveis.** Com altura fixa, `offsetOf` e `indexAt` são O(1). Com alturas variáveis, a construção é O(n) (soma de prefixos em um `Float64Array`) e cada consulta é O(log n). As alturas são conhecidas de antemão (derivadas do tamanho da observação); medir o DOM de verdade exigiria estimativas e correção de rolagem, o que está fora do escopo.
- **Reuso de nós.** O mapa `índice → nó` descarta só o que saiu da janela e cria só o que entrou, de modo que rolar um pouco mexe em poucos elementos.
- **Busca linear sem índice.** Filtrar 100 mil linhas leva dezenas de milissegundos; há debounce de 150 ms na digitação. Para milhões de linhas valeria mover a busca para um Web Worker ou usar um índice invertido.
- **Complexidade de memória.** O DOM tem O(viewport/altura) nós, independente do tamanho da lista; os dados continuam O(n) em memória.

## Estrutura de pastas

```
VirtualList/
├── index.html
├── style.css
├── src/
│   ├── windowing.js    # matemática de janelas (pura)
│   ├── virtual-list.js # integração com o DOM
│   ├── search.js       # filtro e destaque
│   ├── data.js         # geração determinística de linhas
│   └── app.js          # página de demonstração
├── tests/
├── package.json
├── LICENSE
└── README.md
```

## Limitações conhecidas

- Alturas variáveis precisam ser conhecidas antes de renderizar; não há medição dinâmica do DOM.
- Pesquisar com a lista de 500 mil linhas bloqueia a thread principal por um instante.
- A busca nativa do navegador (`Ctrl+F`) não encontra linhas que não estão renderizadas, limitação inerente à virtualização.
- Só há rolagem vertical e seleção de uma linha por vez.
- Rolagem suave para posições muito distantes depende da implementação do navegador.
- A integração com o DOM (`virtual-list.js`, `app.js`) não tem testes automatizados.

## Licença

MIT. Veja o arquivo [LICENSE](LICENSE).
