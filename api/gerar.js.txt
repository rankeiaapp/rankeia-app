// ============================================================
//  /api/gerar  —  Backend seguro do Rankeia (Vercel Function)
//  - Guarda a chave Anthropic no servidor (nunca vai ao browser)
//  - Valida o token Firebase do usuário
//  - Confere o plano e o limite de gerações no Firestore
//  - Aplica rate limiting básico
// ============================================================

import admin from 'firebase-admin';

// ---- Inicializa Firebase Admin (uma única vez) ----
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // a chave privada vem com \n escapado na env var
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// ---- System prompt (mesmo do app) ----
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

export default async function handler(req, res) {
  // ---- Só aceita POST ----
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // ---- 1. Verifica o token do Firebase ----
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch {
      return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    }
    const uid = decoded.uid;

    // ---- 2. Busca o perfil do usuário no Firestore ----
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return res.status(403).json({ error: 'Perfil não encontrado.' });
    }
    const profile = snap.data();
    const plano = profile.plano || 'free';
    const geracoesUsadas = profile.geracoesUsadas || 0;

    // ---- 3. Valida o plano / limite (paywall no servidor) ----
    const isPago = plano === 'basico' || plano === 'pro';
    if (!isPago && geracoesUsadas >= 1) {
      return res.status(402).json({ error: 'PAYWALL', message: 'Geração grátis esgotada.' });
    }

    // ---- 4. Rate limiting básico (anti-abuso) ----
    const agora = Date.now();
    const ultimaGeracao = profile.ultimaGeracao?.toMillis?.() || 0;
    if (agora - ultimaGeracao < 3000) {
      return res.status(429).json({ error: 'Aguarde alguns segundos antes de gerar novamente.' });
    }

    // ---- 5. Monta a requisição ----
    const { product, category, diff, platforms, tiktokScript } = req.body || {};
    if (!product || !Array.isArray(platforms) || !platforms.length) {
      return res.status(400).json({ error: 'Dados incompletos.' });
    }

    const userMsg = `Produto: ${product}
Categoria: ${category || 'Não informada'}
Diferenciais: ${diff || 'Não informados'}
Plataformas solicitadas: ${platforms.join(', ')}
Script TikTok: ${tiktokScript ? 'sim' : 'não'}`;

    // ---- 6. Chama a Anthropic (chave fica AQUI, no servidor) ----
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!anthropicRes.ok) {
      const status = anthropicRes.status;
      if (status === 429) return res.status(429).json({ error: 'Limite da IA atingido. Tente em instantes.' });
      return res.status(502).json({ error: 'Erro ao gerar. Tente novamente.' });
    }

    const data = await anthropicRes.json();
    const raw = data.content[0].text;
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: 'Resposta inválida da IA. Tente novamente.' });
    }

    // ---- 7. Incrementa o contador no servidor (fonte da verdade) ----
    await userRef.update({
      totalGerado: admin.firestore.FieldValue.increment(1),
      geracoesUsadas: admin.firestore.FieldValue.increment(1),
      ultimaGeracao: admin.firestore.FieldValue.serverTimestamp(),
    });

    // ---- 8. Devolve o resultado ----
    return res.status(200).json(result);

  } catch (err) {
    console.error('Erro /api/gerar:', err);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }
}
