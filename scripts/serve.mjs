// Serves the app on your local network so a phone on the same Wi-Fi can open it.
// HTTPS (self-signed) is the default because phones only allow the microphone on secure pages.
// Run: npm run phone        (HTTPS, port 5443)
//      npm run phone -- --http   (plain HTTP, port 5173; speaking exercises won't work on the phone)
import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { join, extname, resolve, normalize } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const CERT_DIR = join(ROOT, '.cert');
const useHttp = process.argv.includes('--http');
const PORT = Number(process.env.PORT) || (useHttp ? 5173 : 5443);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

const lanIps = () => Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);

// Creates (once) a self-signed certificate valid for localhost and the current LAN addresses.
async function certificate() {
  const key = join(CERT_DIR, 'key.pem');
  const cert = join(CERT_DIR, 'cert.pem');
  const ips = lanIps();
  const marker = join(CERT_DIR, ips.join('_') || 'none');
  if (!existsSync(marker)) {
    await mkdir(CERT_DIR, { recursive: true });
    const san = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => `IP:${ip}`)].join(',');
    try {
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '825',
        '-subj', '/CN=Dilbaz local', '-addext', `subjectAltName=${san}`], { stdio: 'ignore' });
    } catch {
      console.error('openssl not found or failed. Install it, or run: npm run phone -- --http');
      process.exit(1);
    }
    await writeFile(marker, ''); // regenerate when the LAN address changes
  }
  return { key: await readFile(key), cert: await readFile(cert) };
}

async function handle(req, res) {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const path = normalize(join(ROOT, pathname.endsWith('/') ? `${pathname}index.html` : pathname));
    if (!path.startsWith(ROOT) || path.includes(`${ROOT}/.`)) return res.writeHead(403).end(); // no traversal, no dotfiles (.cert, .git)
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

const server = useHttp ? createHttp(handle) : createHttps(await certificate(), handle);
server.listen(PORT, '0.0.0.0', () => {
  const scheme = useHttp ? 'http' : 'https';
  console.log(`Dilbaz is running.\n  This computer: ${scheme}://localhost:${PORT}`);
  for (const ip of lanIps()) console.log(`  Phone (same Wi-Fi): ${scheme}://${ip}:${PORT}`);
  if (!useHttp) console.log('\nThe phone will warn about the certificate once: tap "Advanced" → "Proceed" (Safari: "Show Details" → "visit this website").');
  console.log('Press Ctrl+C to stop.');
});
