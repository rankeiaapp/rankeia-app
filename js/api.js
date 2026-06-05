/* ============================================================
   API — chama o backend seguro do Rankeia
   A chave da Anthropic NÃO fica mais aqui. Fica no servidor.
============================================================ */

async function gerarAnuncio({ product, category, diff, platforms, tiktokScript }) {

  const response = await fetch('/api/gerar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product, category, diff, platforms, tiktokScript }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error || `Erro HTTP ${response.status}`;
    if (response.status === 429) throw new Error('Muitas requisições. Aguarde e tente novamente.');
    throw new Error(msg);
  }

  return await response.json();
}
