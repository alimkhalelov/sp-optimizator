import fs from 'node:fs';

const d = JSON.parse(fs.readFileSync('data/benchmark.json', 'utf8'));
d.flashLite = {
  model: 'gemini-3.5-flash-lite',
  pricingPer1M: { inputUsd: 0.30, outputUsd: 2.50 },
  countTokens: { totalTokens: 1057, imageTokens: 1044, textTokens: 13 },
  verboseRun: { ttftMs: 3502, totalMs: 5463, inputTokens: 1062, outputTokens: 669, thoughtTokens: 604 },
  highResLowThink: { ttftMs: 1358, totalMs: 1444, inputTokens: 1059, outputTokens: 61 },
  highResMedThink: { ttftMs: 4193, totalMs: 4205, inputTokens: 1059, outputTokens: 47, thoughtTokens: 1386, accurate: true },
  textMinRun: { ttftMs: 2227, totalMs: 2271, inputTokens: 3517, outputTokens: 62, thoughtTokens: 0, accurate: true }
};
fs.writeFileSync('data/benchmark.json', JSON.stringify(d, null, 2), 'utf8');
console.log('UPDATED_FLASH_LITE_OK', Object.keys(d));
