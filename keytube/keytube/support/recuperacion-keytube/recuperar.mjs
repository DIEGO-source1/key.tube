// Recuperación específica de KeyTube, pnpm 11.25.0 / store v11.
// Las huellas pertenecen al pnpm-lock.yaml original del proyecto.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const bundle = path.dirname(fileURLToPath(import.meta.url));
const project = process.cwd();
const onlyCache = process.argv.includes('--solo-cache');
const packages = [
  { name: 'next', version: '16.3.4', file: 'next-16.3.4.tgz', integrity: 'sha512-/Ztf6CeRH+ejEXUrYtqI4gkS66eFIHuSwqi60RgcpWKodxFZx2/dqVCMKBwILfAHXQ+F1b1vAudgj3mnxqtoIA==' },
  { name: '@next/swc-win32-x64-msvc', version: '16.3.4', file: 'swc-win32-x64-msvc-16.3.4.tgz', integrity: 'sha512-vvBzwu1pYQCp92maZCFCIw/XgOTMR5tur9GjakwIo2cmwRTMKajRZZDS9+e4KsUZWKu1E007WUeAFXRRjZeuzw==' },
  { name: '@cloudflare/workerd-windows-64', version: '1.20260515.1', file: 'workerd-windows-64-1.20260515.1.tgz', integrity: 'sha512-WmV/iv+MHjYsvkcMVzpM2B5/mf06UUkdpVhZrtMfV9graWjBGPYFvE/eab8748RPVGKh1Xe1vXofLzDSwc08lA==' },
];

function runPnpm(args, { cwd = project, capture = false } = {}) {
  let executable = 'pnpm';
  let commandArgs = args;
  // Optional explicit CLI path for repeatable validation; no shell evaluation.
  if (process.env.KEYTUBE_PNPM_CLI) {
    executable = process.execPath;
    commandArgs = [path.resolve(process.env.KEYTUBE_PNPM_CLI), ...args];
  } else if (process.platform === 'win32') {
    // PowerShell's call operator preserves paths containing spaces and apostrophes.
    // EncodedCommand carries the literal script, not a change to execution policy.
    const quote = value => "'" + value.replaceAll("'", "''") + "'";
    const script = "$ErrorActionPreference = 'Stop'; & 'pnpm.cmd' " + args.map(quote).join(' ') + '; exit $LASTEXITCODE';
    executable = 'powershell.exe';
    commandArgs = ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
  }
  return new Promise((resolve, reject) => {
    const child = spawn(executable, commandArgs, { cwd, windowsHide: true, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let output = '';
    if (capture) child.stdout.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`pnpm terminó con código ${code}. Revisa el error que aparece arriba.`)));
  });
}

async function fileIntegrity(filename) {
  const hash = createHash('sha512');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return 'sha512-' + hash.digest('base64');
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8'));
  if (manifest.name !== 'keytube') throw new Error('Ejecuta este comando desde la carpeta keytube, donde está package.json.');
  const lockPath = path.join(project, 'pnpm-lock.yaml');
  const originalLock = await readFile(lockPath, 'utf8');
  for (const pkg of packages) {
    if (!originalLock.includes(pkg.name + '@' + pkg.version) || !originalLock.includes(pkg.integrity)) {
      throw new Error(`Tu lockfile no coincide con este paquete de recuperación: ${pkg.name}@${pkg.version}.`);
    }
  }
  const version = await runPnpm(['--version'], { capture: true });
  if (version !== '11.25.0') throw new Error(`Este recuperador se comprobó con pnpm 11.25.0. Tu versión es ${version}. No se modificó la caché.`);
  const { DatabaseSync } = await import('node:sqlite');
  console.log('\n[1/4] Comprobando los tres archivos descargados...');
  for (const pkg of packages) {
    if (await fileIntegrity(path.join(bundle, pkg.file)) !== pkg.integrity) {
      throw new Error(`El archivo ${pkg.file} está incompleto o modificado. Vuelve a extraer el ZIP.`);
    }
    console.log('  OK ' + pkg.name + '@' + pkg.version);
  }

  const storePath = await runPnpm(['--reporter=silent', 'store', 'path'], { capture: true });
  if (!path.isAbsolute(storePath) || path.basename(storePath) !== 'v11') {
    throw new Error('La ruta de la caché no tiene el formato v11 esperado: ' + storePath);
  }
  console.log('\n[2/4] Incorporando los archivos locales a tu caché...');
  await runPnpm([
    '--config.offline=true', '--config.store-dir=' + path.dirname(storePath),
    'store', 'add', ...packages.map(pkg => path.join(bundle, pkg.file)),
  ], { cwd: bundle });

  // pnpm indexes local tarballs as file:... rather than name@version. Copy only
  // these three content-verified records under the original registry identities.
  // Do not replace the database: it contains the user's other cached packages.
  console.log('\n[3/4] Asociando los archivos verificados con el lockfile original...');
  const db = new DatabaseSync(path.join(storePath, 'index.db'));
  let transaction = false;
  try {
    db.exec('PRAGMA busy_timeout=5000');
    const columns = db.prepare('PRAGMA table_info(package_index)').all().map(row => row.name);
    if (columns.length !== 2 || !columns.includes('key') || !columns.includes('data')) {
      throw new Error('El índice de pnpm tiene un formato diferente. Se detuvo la recuperación.');
    }
    db.exec('BEGIN IMMEDIATE');
    transaction = true;
    const writes = packages.map(pkg => {
      const prefix = pkg.integrity + '\tfile:';
      const local = db.prepare('SELECT data FROM package_index WHERE substr(key, 1, ?) = ? LIMIT 1').get(prefix.length, prefix);
      if (!local) throw new Error('pnpm no registró el archivo local de ' + pkg.name);
      const key = pkg.integrity + '\t' + pkg.name + '@' + pkg.version;
      const previous = db.prepare('SELECT data FROM package_index WHERE key = ?').get(key);
      return { key, data: local.data, previous: previous ? Buffer.from(previous.data).toString('base64') : null };
    });
    const backup = path.join(bundle, `cache-backup-${Date.now()}.json`);
    await writeFile(backup, JSON.stringify({ storePath, records: writes.map(({ key, previous }) => ({ key, previous })) }, null, 2), { flag: 'wx' });
    const insert = db.prepare('INSERT OR REPLACE INTO package_index (key, data) VALUES (?, ?)');
    for (const row of writes) insert.run(row.key, row.data);
    db.exec('COMMIT');
    transaction = false;
    const checkpoint = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    if (checkpoint.busy) throw new Error('La caché sigue ocupada por otra instalación. Ciérrala y repite la recuperación.');
  } catch (error) {
    if (transaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
  if (await readFile(lockPath, 'utf8') !== originalLock) {
    throw new Error('El lockfile cambió durante la recuperación. Cierra otras instalaciones antes de continuar.');
  }
  console.log('Los tres paquetes quedaron disponibles en tu caché.');
  if (onlyCache) return;

  console.log('\n[4/4] Completando la instalación con los paquetes de tu caché...');
  console.log('Se mantienen las comprobaciones de seguridad del proyecto.');
  await runPnpm([
    'install', '--frozen-lockfile', '--offline', '--reporter=append-only',
    '--config.fetch-retries=0', '--config.fetch-timeout=20000',
  ]);
  console.log('\nInstalación completada. Ahora puedes ejecutar pnpm.cmd db:setup y después pnpm.cmd dev.');
}

main().catch(error => {
  console.error('\nNo se completó la recuperación: ' + error.message);
  console.error('Copia las últimas líneas de esta consola para revisar el siguiente paso.');
  process.exitCode = 1;
});
