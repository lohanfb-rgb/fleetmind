export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { accessKey } = req.body;
  if (!accessKey) return res.status(200).json({ history: [] });

  const KV_URL   = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  try {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['GET', `history:${accessKey}`])
    });

    const d = await r.json();

    if (!d || d.result === null || d.result === undefined) {
      return res.status(200).json({ history: [] });
    }

    const history = JSON.parse(d.result);
    return res.status(200).json({ history: Array.isArray(history) ? history : [] });

  } catch (e) {
    return res.status(200).json({ history: [] });
  }
}
