export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  const { messages, systemPrompt, system, accessKey } = req.body;
  const finalSystem = systemPrompt || system || '';
  const currentMessages = messages || [];
 
  if (!currentMessages.length) {
    return res.status(400).json({ error: 'Missing messages' });
  }
 
  const KV_URL   = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
 
  // Upstash REST API: envia comandos Redis como array
  async function upstash(command) {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(command)
    });
    return r.json();
  }
 
  async function kvGet(key) {
    try {
      const d = await upstash(['GET', key]);
      if (!d || d.result === null || d.result === undefined) return null;
      return JSON.parse(d.result);
    } catch { return null; }
  }
 
  async function kvSet(key, value) {
    try {
      await upstash(['SET', key, JSON.stringify(value)]);
    } catch {}
  }
 
  // Busca histórico salvo da chave
  let history = [];
  if (accessKey && KV_URL && KV_TOKEN) {
    const saved = await kvGet(`history:${accessKey}`);
    if (Array.isArray(saved)) history = saved;
  }
 
  // Monta mensagens: histórico + mensagem atual
  const lastUserMsg = currentMessages[currentMessages.length - 1];
  const allMessages = [...history, lastUserMsg];
  const trimmedMessages = allMessages.slice(-30);
 
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: [
          {
            type: 'text',
            text: finalSystem,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: trimmedMessages
      })
    });
 
    const data = await response.json();
 
    if (!response.ok) {
      return res.status(200).json({ reply: 'Erro API: ' + (data.error?.message || JSON.stringify(data.error)) });
    }
 
    const reply = data.content?.find(b => b.type === 'text')?.text || '';
 
    // Salva histórico atualizado
    if (accessKey && KV_URL && KV_TOKEN) {
      const updatedHistory = [
        ...trimmedMessages,
        { role: 'assistant', content: reply }
      ].slice(-30);
      await kvSet(`history:${accessKey}`, updatedHistory);
    }
 
    return res.status(200).json({ reply });
 
  } catch (err) {
    return res.status(200).json({ reply: 'Erro interno: ' + err.message });
  }
}
