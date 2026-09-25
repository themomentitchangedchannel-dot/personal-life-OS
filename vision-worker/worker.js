const ORIGIN = 'https://themomentitchangedchannel-dot.github.io';
const MODEL = 'gemini-3.1-flash-lite';
const cors = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export default {
  async fetch(request, env) {
    if (request.headers.get('Origin') !== ORIGIN) return reply({ error: 'Nedovoljen izvor.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ error: 'Nedovoljena metoda.' }, 405);
    if (!env.GEMINI_API_KEY) return reply({ error: 'Storitev še ni nastavljena.' }, 503);
    if (Number(request.headers.get('Content-Length')) > 2_000_000) return reply({ error: 'Slika je prevelika.' }, 413);
    let payload;
    try { payload = await request.json(); } catch { return reply({ error: 'Neveljaven zahtevek.' }, 400); }
    if (typeof payload?.image !== 'string' || payload.image.length > 2_000_000
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.image)) return reply({ error: 'Neveljavna slika.' }, 400);
    try {
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: 'Poglej fotografijo hrane. Če je na njej prepoznavna jed, vrni samo JSON z "title" (kratko slovensko ime jedi) in "kind" (breakfast, lunch, dinner ali snack). Če ni jedi ali je ne moreš zanesljivo prepoznati, vrni {"title":"","kind":""}. Ne ugibaj skritih sestavin, količin ali kalorij.' },
            { inline_data: { mime_type: 'image/jpeg', data: payload.image } }
          ] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 120 }
        })
      });
      if (!upstream.ok) return reply({ error: 'Storitev prepoznave trenutno ni na voljo.' }, 502);
      const result = await upstream.json();
      const answer = JSON.parse(result.candidates?.[0]?.content?.parts?.find(part => part.text)?.text || '{}');
      if (typeof answer.title !== 'string' || !answer.title.trim()) return reply({ error: 'Jedi ni bilo mogoče prepoznati.' }, 422);
      return reply({ title: answer.title.trim().slice(0, 120),
        kind: ['breakfast', 'lunch', 'dinner', 'snack'].includes(answer.kind) ? answer.kind : 'lunch' });
    } catch { return reply({ error: 'Prepoznava trenutno ni uspela.' }, 502); }
  }
};
