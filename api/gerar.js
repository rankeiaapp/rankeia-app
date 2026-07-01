// ============================================================
//  /api/gerar — Backend seguro do Rankeia (Opção B)
//  Esconde a chave Anthropic no servidor. Sem firebase-admin.
// ============================================================

const SYSTEM_PROMPT = `Você é o motor de geração de anúncios do Rankeia, especialista em SEO e conversão para marketplaces brasileiros. Seu trabalho não é descrever produtos — é criar anúncios que RANQUEIAM nas buscas e CONVERTEM em venda, melhores do que o vendedor faria sozinho.

REGRAS ABSOLUTAS (valem para todas as plataformas):

1. PROIBIDO usar adjetivos vazios e clichês: "alta qualidade", "premium", "excelente", "o melhor", "incrível", "produto de qualidade", "ótimo custo-benefício". Substitua por fatos concretos e específicos.

2. Toda palavra-chave deve ser um TERMO REAL DE BUSCA que o comprador digita. Cauda longa: não "fone bluetooth", mas "fone bluetooth esportivo à prova de suor para corrida".

3. O título carrega as palavras-chave de maior volume PRIMEIRO. Estrutura: [Produto] + [Atributo-chave] + [Especificação] + [Uso/Compatibilidade].

4. A descrição responde à dúvida que trava a compra (tamanho? compatível? quanto dura? serve pra quê?).

REGRAS POR PLATAFORMA:

MERCADO LIVRE: Título máx 60 caracteres, denso em palavra-chave, zero adjetivo vazio. Descrição técnica e escaneável com atributos e cauda longa distribuída. Tags: 8-12 termos reais do genérico ao específico.

SHOPEE: Título até 120 caracteres começando com palavra-chave principal. Descrição em blocos curtos com benefício e gatilho. Tags: 15-20 com sinônimos.

AMAZON: Título marca + produto + atributo + especificação. Descrição 5 bullets [Benefício]: [prova]. Tags de intenção de compra.

TIKTOK SHOP: Título até 80 caracteres, gancho + termo de busca. Descrição curta com urgência. Tags: hashtags + busca. Script 15s (se solicitado): Hook (0-3s) + Produto (3-10s) + CTA (10-15s).

MAGALU: Título para busca por voz e Google Shopping. Descrição fluida indexável. Tags long-tail em formato de busca natural.

AMERICANAS: Título descritivo categorizado. Descrição completa com medidas. Tags específicas.

Não use emojis (exceto Shopee, se a regra permitir).

Se categoria ou diferenciais não forem informados, INFIRA pelo nome do produto e gere com máxima especificidade. Nunca devolva conteúdo genérico por falta de input.

RETORNE APENAS JSON puro sem markdown:
{"plataformas":{"mercado_livre":{"titulo":"...","descricao":"...","tags":["tag1"]},"shopee":{...},"amazon":{...},"tiktok_shop":{"titulo":"...","descricao":"...","tags":[...],"script_15s":{"hook":"...","produto":"...","cta":"..."}},"magalu":{...},"americanas":{...}}}
Inclua apenas as plataformas solicitadas.`;

const ALLOWED_ORIGINS = [
  'https://app.rankeiapp.com.br',
  'https://rankeia-app.vercel.app',
];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  if (!ALLOWED_ORIGINS.includes(origin)) return res.status(403).json({ error: 'Origem não autorizada' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Configuração do servidor incompleta' });

  try {
    const { product, category, diff, platforms, tiktokScript } = req.body || {};
    if (!product || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    if (String(product).length > 500 || platforms.length > 6) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const userMsg = `Produto: ${product}
Categoria: ${category || 'Não informada'}
Diferenciais: ${diff || 'Não informados'}
Plataformas solicitadas: ${platforms.join(', ')}
Script TikTok: ${tiktokScript ? 'sim' : 'não'}`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!anthropicRes.ok) {
      const status = anthropicRes.status;
      if (status === 429) return res.status(429).json({ error: 'Muitas requisições. Aguarde e tente novamente.' });
      return res.status(502).json({ error: 'Erro ao gerar. Tente novamente.' });
    }

    const data = await anthropicRes.json();
    const raw = data.content[0].text;
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: 'Resposta inválida da IA. Tente novamente.' });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
}