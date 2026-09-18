import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { walkFiles } from './utils/fs-helpers.js';
import { encryptBuffer, decryptBuffer } from './crypto.js';

const MANIFEST_ENTRY = 'manifest.json';
const PAYLOAD_PREFIX = 'payload';

/**
 * Builds the backup archive. `items` are the discovered+selected items
 * from discovery/index.js. Sensitive items are encrypted file-by-file
 * before being added, so a stolen archive never leaks plaintext
 * credentials even if the rest of the backup is inspectable.
 *
 * Returns the manifest object that was written (also embedded in the
 * archive as manifest.json, unencrypted, so `status`/`diff` can inspect
 * a backup without needing the passphrase).
 */
export async function createArchive({ outputPath, items, passphrase, meta }) {
  const zip = new AdmZip();
  const manifestItems = [];

  for (const item of items) {
    const entry = { ...item, encrypted: false, archivePaths: [] };

    if (item.type === 'file') {
      const buf = await fs.readFile(item.path);
      const stored = item.sensitive ? encryptBuffer(buf, passphrase) : buf;
      const archivePath = `${PAYLOAD_PREFIX}/${item.id}${item.sensitive ? '.enc' : ''}`;
      zip.addFile(archivePath, stored);
      entry.encrypted = item.sensitive;
      entry.archivePaths = [archivePath];
    } else {
      const files = await walkFiles(item.path);
      for (const f of files) {
        const buf = await fs.readFile(f.abs);
        const stored = item.sensitive ? encryptBuffer(buf, passphrase) : buf;
        const archivePath = `${PAYLOAD_PREFIX}/${item.id}/${f.rel}${item.sensitive ? '.enc' : ''}`;
        zip.addFile(archivePath, stored);
        entry.archivePaths.push(archivePath);
      }
      entry.encrypted = item.sensitive;
    }

    manifestItems.push(entry);
  }

  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    ...meta,
    items: manifestItems.map(stripAbsolutePathForPortability),
  };

  zip.addFile(MANIFEST_ENTRY, Buffer.from(JSON.stringify(manifest, null, 2)));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  zip.writeZip(outputPath);

  return manifest;
}

// The manifest travels between machines; keep the original absolute
// source path for reference/diffing, but it's informational only —
// restore always re-resolves destination paths for the CURRENT machine.
function stripAbsolutePathForPortability(entry) {
  return entry;
}

export function readManifest(archivePath) {
  const zip = new AdmZip(archivePath);
  const entry = zip.getEntry(MANIFEST_ENTRY);
  if (!entry) throw new Error(`${archivePath} is not a valid claude-backup archive (no manifest.json).`);
  return JSON.parse(zip.readAsText(entry));
}

/**
 * Extracts one manifest item's content. Returns a Map of relPath -> Buffer
 * (relPath is '' for single-file items) with sensitive content already
 * decrypted, so callers never see raw .enc bytes.
 */
export function readItemContent(archivePath, manifestItem, passphrase) {
  const zip = new AdmZip(archivePath);
  const out = new Map();

  for (const archivePath_ of manifestItem.archivePaths) {
    const entry = zip.getEntry(archivePath_);
    if (!entry) throw new Error(`Archive entry missing: ${archivePath_}`);
    let buf = entry.getData();
    if (manifestItem.encrypted) {
      if (!passphrase) throw new Error(`Passphrase required to restore "${manifestItem.label}".`);
      buf = decryptBuffer(buf, passphrase);
    }

    let relPath = '';
    if (manifestItem.type === 'dir') {
      const prefix = `${PAYLOAD_PREFIX}/${manifestItem.id}/`;
      relPath = archivePath_.slice(prefix.length).replace(/\.enc$/, '');
    }
    out.set(relPath, buf);
  }

  return out;
}
