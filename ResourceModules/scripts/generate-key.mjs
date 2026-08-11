import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const privatePath = resolve(process.argv[2] ?? '.private/official-v1-private.pem');
const publicPath = resolve(process.argv[3] ?? 'keys/official-v1-public.pem');
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privatePEM = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicPEM = publicKey.export({ type: 'spki', format: 'pem' });

await mkdir(dirname(privatePath), { recursive: true, mode: 0o700 });
await mkdir(dirname(publicPath), { recursive: true });
await writeFile(privatePath, privatePEM, { mode: 0o600, flag: 'wx' });
await writeFile(publicPath, publicPEM, { mode: 0o644, flag: 'wx' });
console.log(`Private key created at ${privatePath}`);
console.log(`Public key created at ${publicPath}`);
