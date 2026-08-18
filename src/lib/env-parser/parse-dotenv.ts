export function parseEnvFile(text: string): Array<{ key: string; value: string }> {
  const results: Array<{ key: string; value: string }> = [];

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    if (!key) continue;

    let value = line.slice(eqIndex + 1);

    // Quoted value — strip quotes, preserve content verbatim
    const dq = value.match(/^"([\s\S]*)"$/);
    const sq = value.match(/^'([\s\S]*)'$/);
    if (dq) {
      value = dq[1];
    } else if (sq) {
      value = sq[1];
    } else {
      // Unquoted: strip inline comment and trim
      const commentIdx = value.indexOf(" #");
      if (commentIdx !== -1) value = value.slice(0, commentIdx);
      value = value.trim();
    }

    results.push({ key, value });
  }

  return results;
}
