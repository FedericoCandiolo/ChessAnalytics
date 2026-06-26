/* Packages the Claude skill into public/downloads/chess-analytics-coach.zip so the
 * built site can offer it as a download. Run automatically via prebuild / prestart;
 * regenerate manually with `npm run build:skill`. Requires the `zip` CLI. */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root      = path.join(__dirname, '..');
const skillDir  = path.join(root, 'claude-skill');
const skillName = 'chess-analytics-coach';
const outDir    = path.join(root, 'public', 'downloads');
const outZip    = path.join(outDir, `${skillName}.zip`);

if (!fs.existsSync(path.join(skillDir, skillName, 'SKILL.md'))) {
  console.error(`[build-skill-zip] skill not found at ${path.join(skillDir, skillName)}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(outZip, { force: true });

try {
  // -X strips extra file attributes; exclude python bytecode caches.
  execSync(`zip -r -X "${outZip}" "${skillName}" -x "*__pycache__*"`, {
    cwd: skillDir,
    stdio: 'inherit',
  });
  console.log(`[build-skill-zip] wrote ${path.relative(root, outZip)}`);
} catch (e) {
  console.error('[build-skill-zip] zip failed. Is the `zip` CLI installed?');
  process.exit(1);
}
