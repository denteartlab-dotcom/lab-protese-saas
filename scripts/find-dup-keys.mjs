import fs from "fs";
const c = fs.readFileSync("src/lib/i18n/messages.ts", "utf8");
for (const loc of ["pt", "en", "es"]) {
  const re = new RegExp(`  ${loc}: \\{([\\s\\S]*?)\\n  \\},\\n  (?:en|es):`);
  const m = c.match(re);
  if (!m) continue;
  const keys = {};
  for (const line of m[1].split("\n")) {
    const km = line.match(/"([^"]+)":/);
    if (km) keys[km[1]] = (keys[km[1]] || 0) + 1;
  }
  const d = Object.entries(keys).filter(([, n]) => n > 1);
  if (d.length) console.log(loc + ":", d.map(([k, n]) => `${k} x${n}`).join(", "));
}
