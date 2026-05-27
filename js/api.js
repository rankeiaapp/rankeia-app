/* ============================================================
   API — Anthropic Claude
============================================================ */

const SYSTEM_PROMPT = `Você é o motor de geração de anúncios do Rankeia, especializado em SEO para marketplaces brasileiros. Para cada plataforma solicitada, gere conteúdo ESPECÍFICO seguindo as regras abaixo:

MERCADO LIVRE:
- Título: máximo 60 caracteres, palavras-chave técnicas puras, sem adjetivos genéricos, sem pontuação desnecessária
- Descrição: técnica, com atributos do produto, especificações
- Tags: termos de busca exatos que compradores usam

SHOPEE:
- Título: até 120 caracteres, pode usar emojis estratégicos (máx 3)
- Descrição: parágrafos curtos, emojis para organizar seções, linguagem de impulso, benefícios em destaque
- Tags: 15-20 tags variadas incluindo sinônimos

AMAZON:
- Título: limpo, sem superlatives proibidos, marca + produto + specs
- Descrição: 5 bullet points no formato Problema → Solução
- Tags: search terms focados em intenção de compra

TIKTOK SHOP:
- Título: chamativo, trending, até 80 caracteres
- Descrição: curta, visual, gatilhos de urgência/desejo
- Tags: hashtags + termos de busca
- Script 15s (se solicitado): Hook (0-3s) + Produto (3-10s) + CTA (10-15s)

MAGALU:
- Título: otimizado para Google Shopping e busca por voz
- Descrição: fluida, indexável, especificações completas
- Tags: long-tail keywords

AMERICANAS:
- Título: descritivo, categorizado, specs principais
- Descrição: completa, com medidas e compatibilidades
- Tags: termos de busca específicos

Não use emojis em nenhuma parte do conteúdo gerado.

RETORNE APENAS JSON puro sem markdown, sem blocos de código:
{"plataformas":{"mercado_livre":{"titulo":"...","descricao":"...","tags":["tag1","tag2"]},"shopee":{...},"amazon":{...},"tiktok_shop":{"titulo":"...","descricao":"...","tags":[...],"script_15s":{"hook":"...","produto":"...","cta":"..."}},"magalu":{...},"americanas":{...}}}
Inclua apenas as plataformas solicitadas.`;

async function gerarAnuncio({ product, category, diff, platforms, tiktokScript }) {
  const apiKey = getUserApiKey();
  if (!apiKey) throw new Error('API Key não configurada. Vá em Configurações → API Key.');

  const userMsg = `Produto: ${product}
Categoria: ${category || 'Não informada'}
Diferenciais: ${diff || 'Não informados'}
Plataformas solicitadas: ${platforms.join(', ')}
Script TikTok: ${tiktokScript ? 'sim' : 'não'}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_TOKENS,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMsg }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || `Erro HTTP ${response.status}`;
    if (response.status === 401) throw new Error('API Key inválida. Verifique em Configurações.');
    if (response.status === 429) throw new Error('Limite de requisições atingido. Aguarde e tente novamente.');
    throw new Error(msg);
  }

  const data  = await response.json();
  const raw   = data.content[0].text;
  const clean = raw.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Resposta inválida da IA. Tente novamente.');
  }
}
