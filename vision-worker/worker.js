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
    const isImage = typeof payload?.image === 'string' && payload.image.length <= 2_000_000
      && /^[A-Za-z0-9+/]+={0,2}$/.test(payload.image);
    const isRecipe = typeof payload?.recipe?.title === 'string' && payload.recipe.title.length <= 120
      && Array.isArray(payload.recipe.ingredients) && payload.recipe.ingredients.length <= 20
      && payload.recipe.ingredients.every(line => typeof line === 'string' && line.length <= 120);
    if (!isImage && !isRecipe) return reply({ error: 'Neveljaven zahtevek.' }, 400);
    const parts = isImage ? [
      { text: 'Poglej fotografijo hrane. Vrni samo JSON: "title" (kratko slovensko ime jedi), "kind" (breakfast, lunch, dinner ali snack), "nutrition" (ocena ZA CELOTNO VIDNO PORCIJO: "portionG", "kcal", "proteinG", "carbsG", "fatG", vsaka številka ali null). Če ni jedi, vrni prazno ime. Če količine ni mogoče razumno oceniti, vrni nutrition:null. Vrednosti so približne, ne trdi da so natančne. Ne izmišljaj si skritih sestavin. Ne vključuj razlage.' },
      { inline_data: { mime_type: 'image/jpeg', data: payload.image } }
    ] : [{ text: `Oceni hranilne vrednosti recepta ZA ENO OSEBO samo iz navedenih sestavin in količin. Vrni samo JSON: {"title":"${payload.recipe.title}","kind":"${payload.recipe.kind || 'lunch'}","nutrition":{"portionG":število ali null,"kcal":število,"proteinG":število,"carbsG":število,"fatG":število}}. Vrednosti so približne. Če količine niso znane, vrni nutrition:null. Sestavine: ${payload.recipe.ingredients.join('; ')}` }];
    try {
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 300 }
        })
      });
      if (!upstream.ok) return reply({ error: 'Storitev prepoznave trenutno ni na voljo.' }, 502);
      const result = await upstream.json();
      const answer = JSON.parse(result.candidates?.[0]?.content?.parts?.find(part => part.text)?.text || '{}');
      if (isImage && (typeof answer.title !== 'string' || !answer.title.trim())) return reply({ error: 'Jedi ni bilo mogoče prepoznati.' }, 422);
      const n = answer.nutrition;
      const valid = n && [['kcal', 10000], ['proteinG', 1000], ['carbsG', 1000], ['fatG', 1000]]
        .every(([key, max]) => typeof n[key] === 'number' && Number.isFinite(n[key]) && n[key] >= 0 && n[key] <= max);
      return reply({ title: isImage ? answer.title.trim().slice(0, 120) : payload.recipe.title,
        kind: ['breakfast', 'lunch', 'dinner', 'snack'].includes(answer.kind) ? answer.kind : 'lunch',
        nutrition: valid ? { portionG: typeof n.portionG === 'number' && n.portionG > 0 && n.portionG <= 5000 ? Math.round(n.portionG) : null,
          kcal: Math.round(n.kcal), proteinG: Math.round(n.proteinG * 10) / 10,
          carbsG: Math.round(n.carbsG * 10) / 10, fatG: Math.round(n.fatG * 10) / 10 } : null });
    } catch { return reply({ error: 'Prepoznava trenutno ni uspela.' }, 502); }
  }
};
