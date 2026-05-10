export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, systemPrompt, system } = req.body;
  const finalSystem = systemPrompt || system || '';
  const finalMessages = messages || [];

  if (!finalMessages.length) {
    return res.status(400).json({ error: 'Missing messages or systemPrompt' });
  }

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
        messages: finalMessages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ reply: 'Erro API: ' + (data.error?.message || JSON.stringify(data.error)) });
    }

    const reply = data.content?.find(b => b.type === 'text')?.text || '';
    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(200).json({ reply: 'Erro interno: ' + err.message });
  }
}
