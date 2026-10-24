export async function openaiJson(system: string, input: unknown): Promise<unknown> {
  if (!process.env.OPENAI_API_KEY) throw new Error('Connect an OpenAI API key in the server environment to continue.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5-mini', response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: system }, { role: 'user', content: JSON.stringify(input) },
      ] }), signal: AbortSignal.timeout(90000), cache: 'no-store',
    });
    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < 2) { await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); continue; }
      throw new Error(response.status === 401 ? 'The OpenAI API key is invalid. Check server configuration.' : `AI processing could not complete (HTTP ${response.status}). Your saved work is unchanged.`);
    }
    const result = await response.json(), content = result.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('The model returned no usable content. Please retry.');
    try { return JSON.parse(content); } catch { throw new Error('The model returned an incomplete response. Please retry.'); }
  }
  throw new Error('AI processing could not complete.');
}
