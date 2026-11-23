import fs from 'node:fs';

const k = process.env.GEMINI_API_KEY;
const u = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen';

const ct = async (name, body) => {
  const r = await fetch(`${u}:countTokens?key=${k}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  console.log('countTokens', name, r.status, await r.text());
};

await ct('text', { contents: [{ role: 'user', parts: [{ text: 'Hello world' }] }] });
const pngB64 = fs.readFileSync('assets/pxpipe_page_1.png').toString('base64');
for (const level of ['MEDIA_RESOLUTION_LOW', 'MEDIA_RESOLUTION_MEDIUM', 'MEDIA_RESOLUTION_HIGH']) {
  await ct(level, {
    contents: [{
      role: 'user',
      parts: [{ inlineData: { mimeType: 'image/png', data: pngB64 }, mediaResolution: { level } }]
    }]
  });
}

const t0 = performance.now();
const r = await fetch(`${u}:generateContent?key=${k}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'Reply with JSON {"ok":true}' }] }],
    generationConfig: { thinkingConfig: { thinkingLevel: 'LOW' } }
  })
});
console.log('gen', r.status, Math.round(performance.now() - t0) + 'ms', await r.text());
