import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface GeminiCliSpawnTarget {
  command: string;
  prefixArgs: string[];
}

const SHIM_PATH = path.join(__dirname, 'gemini-cli-shim.mjs');

export function resolveGeminiCliExecutable(cliCommand: string): GeminiCliSpawnTarget {
  const raw = (cliCommand || 'gemini').trim() || 'gemini';
  const trimmed = raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  const asTarget = (command: string, prefixArgs: string[] = []): GeminiCliSpawnTarget => ({ command, prefixArgs });
  const ext = path.extname(trimmed).toLowerCase();
  const cmdLikeExt = ext === '.cmd' || ext === '.bat';

  const wrapWithShim = (geminiEntry: string): GeminiCliSpawnTarget =>
    fs.existsSync(SHIM_PATH)
      ? asTarget(process.execPath, [SHIM_PATH, geminiEntry])
      : asTarget(process.execPath, [geminiEntry]);

  const tryNodeEntryFromShim = (shimPath: string): GeminiCliSpawnTarget | null => {
    const shimDir = path.dirname(shimPath);
    const pkgRoot = path.join(shimDir, 'node_modules', '@google', 'gemini-cli');
    try {
      const pkgJsonPath = path.join(pkgRoot, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')) as {
          bin?: string | Record<string, string>;
          main?: string;
        };
        const binEntry =
          typeof pkg.bin === 'string'
            ? pkg.bin
            : (pkg.bin && (pkg.bin.gemini ?? Object.values(pkg.bin)[0])) ?? pkg.main;
        if (binEntry) {
          const resolved = path.join(pkgRoot, binEntry);
          if (fs.existsSync(resolved)) return wrapWithShim(resolved);
        }
      }
    } catch {
      // fall through to static candidates
    }
    const candidates = [
      path.join(pkgRoot, 'bundle', 'gemini.js'),
      path.join(pkgRoot, 'dist', 'index.js'),
      path.join(pkgRoot, 'bin', 'gemini.js'),
      path.join(pkgRoot, 'index.js'),
    ];
    const entry = candidates.find((candidate) => fs.existsSync(candidate));
    return entry ? wrapWithShim(entry) : null;
  };

  if (path.isAbsolute(trimmed)) {
    if (fs.existsSync(trimmed)) {
      if (process.platform === 'win32' && cmdLikeExt) return tryNodeEntryFromShim(trimmed) ?? asTarget(trimmed);
      return asTarget(trimmed);
    }
    const withCmd = `${trimmed}.cmd`;
    if (fs.existsSync(withCmd)) return tryNodeEntryFromShim(withCmd) ?? asTarget(withCmd);
    const withExe = `${trimmed}.exe`;
    if (fs.existsSync(withExe)) return asTarget(withExe);
    if (process.platform === 'win32' && !ext) return asTarget(withCmd);
    return asTarget(trimmed);
  }

  if (trimmed.includes(path.sep) || trimmed.includes('/')) {
    return process.platform === 'win32' && !ext ? asTarget(`${trimmed}.cmd`) : asTarget(trimmed);
  }
  if (process.platform !== 'win32') return asTarget(trimmed);

  const tryWhere = (name: string): string | null => {
    try {
      const stdout = execSync(`where.exe ${name}`, {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return lines.find((candidate) => /\.(cmd|exe|bat)$/i.test(candidate) && fs.existsSync(candidate))
        ?? lines.find((candidate) => fs.existsSync(candidate))
        ?? null;
    } catch {
      return null;
    }
  };

  const fromWhere = tryWhere(`${trimmed}.cmd`) ?? tryWhere(`${trimmed}.exe`) ?? tryWhere(trimmed);
  if (fromWhere) {
    const isCmd = /\.(cmd|bat)$/i.test(fromWhere);
    return isCmd ? tryNodeEntryFromShim(fromWhere) ?? asTarget(fromWhere) : asTarget(fromWhere);
  }

  const appData = process.env.APPDATA;
  if (appData) {
    const npmShim = path.join(appData, 'npm', `${trimmed}.cmd`);
    if (fs.existsSync(npmShim)) return tryNodeEntryFromShim(npmShim) ?? asTarget(npmShim);
  }
  const userProfile = process.env.USERPROFILE;
  if (userProfile) {
    const npmShim = path.join(userProfile, 'AppData', 'Roaming', 'npm', `${trimmed}.cmd`);
    if (fs.existsSync(npmShim)) return tryNodeEntryFromShim(npmShim) ?? asTarget(npmShim);
  }

  return asTarget(trimmed);
}
