import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const root = process.cwd();
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), `drumulizer-${version}-`));
const releaseDir = path.join(root, 'release');
const outputsDir = path.join(root, 'outputs');
const installerName = `Drumulizer Setup ${version}.exe`;
const portableName = `Drumulizer ${version}.exe`;

const commandForPlatform = (command, args) => {
  if (process.platform !== 'win32') return { command, args };
  return {
    command: process.env.ComSpec ?? 'cmd.exe',
    args: ['/d', '/s', '/c', command, ...args],
  };
};

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const normalized = commandForPlatform(command, args);
    const child = spawn(normalized.command, normalized.args, {
      stdio: 'inherit',
      windowsHide: true,
      ...options,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
    child.on('error', reject);
  });

const copyWithRetry = async (from, to, attempts = 6) => {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 + attempt * 300));
    }
  }
  throw lastError;
};

const smokePackagedApp = (exePath) =>
  new Promise((resolve, reject) => {
    const child = spawn(exePath, [], {
      cwd: path.dirname(exePath),
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, DRUMULIZER_PACKAGED_SMOKE: '1' },
    });
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };
    child.once('error', finish);
    child.once('exit', (code) => {
      if (!settled && code !== 0) finish(new Error(`Packaged smoke exited early with ${code}`));
    });
    setTimeout(() => {
      if (!child.killed) child.kill();
      finish();
    }, 5000);
  });

try {
  console.log(`Packaging Drumulizer ${version} into staging directory: ${stagingRoot}`);
  await run('npx.cmd', [
    'electron-builder',
    '--win',
    '--x64',
    '--publish',
    'never',
    '--config',
    'electron-builder.yml',
    `--config.directories.output=${stagingRoot}`,
  ]);

  const installer = path.join(stagingRoot, installerName);
  const portable = path.join(stagingRoot, portableName);
  const unpackedExe = path.join(stagingRoot, 'win-unpacked', 'Drumulizer.exe');
  await Promise.all([fs.access(installer), fs.access(portable), fs.access(unpackedExe)]);

  console.log(`Running packaged smoke validation: ${unpackedExe}`);
  await smokePackagedApp(unpackedExe);

  await fs.mkdir(releaseDir, { recursive: true });
  await fs.mkdir(outputsDir, { recursive: true });
  for (const name of [installerName, portableName]) {
    const source = path.join(stagingRoot, name);
    await copyWithRetry(source, path.join(releaseDir, name));
    await copyWithRetry(source, path.join(outputsDir, name));
  }
  console.log(`Stable artifacts copied to: ${releaseDir}`);
  console.log(`User artifacts copied to: ${outputsDir}`);
} finally {
  try {
    await fs.rm(stagingRoot, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Could not fully remove staging directory ${stagingRoot}: ${error.message}`);
  }
}
