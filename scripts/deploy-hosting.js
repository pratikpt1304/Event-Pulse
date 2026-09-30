import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleAuth } from 'google-auth-library';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SERVICE_ACCOUNT_PATH = path.join(projectRoot, 'functions', 'serviceAccountKey.json');
const DIST_DIR = path.join(projectRoot, 'dist');
const FIREBASE_JSON_PATH = path.join(projectRoot, 'firebase.json');
const SITE_ID = 'eventpulse-su-34a42';

import zlib from 'zlib';

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function deploy() {
  console.log(`🚀 Starting direct deployment to Firebase Hosting for site: ${SITE_ID}...`);

  if (!fs.existsSync(DIST_DIR)) {
    throw new Error('dist directory does not exist! Run npm run build first.');
  }

  // 1. Authenticate with Service Account
  const auth = new GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']
  });
  const client = await auth.getClient();
  console.log('✅ Authenticated successfully via Service Account.');

  // 2. Hosting config for REST API
  const cspDirectives = [
    "default-src 'self' https://*.firebaseio.com https://*.googleapis.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseio.com https://*.googleapis.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com https://*.firebaseapp.com",
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ');

  const hostingConfig = {
    rewrites: [
      {
        glob: '**',
        path: '/index.html'
      }
    ],
    headers: [
      {
        glob: '**',
        headers: {
          'X-Frame-Options': 'SAMEORIGIN',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
          'Content-Security-Policy': cspDirectives,
          'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
        }
      },
      {
        glob: '**/*.@(html|htm)',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      },
      {
        glob: '/assets/**',
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      }
    ]
  };

  // 3. Create a new version
  console.log('📦 Creating new version...');
  const createVersionRes = await client.request({
    url: `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/versions`,
    method: 'POST',
    data: { config: hostingConfig }
  });

  const versionName = createVersionRes.data.name;
  console.log(`✅ Version created: ${versionName}`);

  // 4. Hash all files in dist
  console.log('🔍 Hashing files in dist directory...');
  const filesList = getAllFiles(DIST_DIR);
  const filesDict = {};
  const hashToBuffer = {};

  for (const filePath of filesList) {
    const relPath = '/' + path.relative(DIST_DIR, filePath).replace(/\\/g, '/');
    const rawBuffer = fs.readFileSync(filePath);
    const gzippedBuffer = zlib.gzipSync(rawBuffer, { level: 9 });
    const hash = computeSha256(gzippedBuffer);
    filesDict[relPath] = hash;
    hashToBuffer[hash] = gzippedBuffer;
  }

  console.log(`📄 Found ${Object.keys(filesDict).length} files to deploy.`);

  // 5. Populate files (tells Firebase which files we have)
  console.log('📤 Sending file manifest to Firebase Hosting...');
  const populateRes = await client.request({
    url: `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`,
    method: 'POST',
    data: { files: filesDict }
  });

  const uploadRequiredHashes = populateRes.data.uploadRequiredHashes || [];
  const uploadUrl = populateRes.data.uploadUrl;
  console.log(`⚡ ${uploadRequiredHashes.length} files need uploading (rest are deduplicated).`);

  // 6. Upload required files
  if (uploadRequiredHashes.length > 0 && uploadUrl) {
    const token = await client.getAccessToken();
    for (let i = 0; i < uploadRequiredHashes.length; i++) {
      const hash = uploadRequiredHashes[i];
      const buffer = hashToBuffer[hash];
      process.stdout.write(`   Uploading [${i + 1}/${uploadRequiredHashes.length}] (${(buffer.length / 1024).toFixed(1)} KB)... `);

      const uploadRes = await fetch(`${uploadUrl}/${hash}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/octet-stream'
        },
        body: buffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload failed for hash ${hash}: ${uploadRes.status} ${uploadRes.statusText} - ${errText}`);
      }
      console.log('✓');
    }
  }

  // 7. Finalize version
  console.log('🔒 Finalizing version status...');
  await client.request({
    url: `https://firebasehosting.googleapis.com/v1beta1/${versionName}?update_mask=status`,
    method: 'PATCH',
    data: { status: 'FINALIZED' }
  });
  console.log('✅ Version finalized.');

  // 8. Release the version live
  console.log('🚀 Publishing release live...');
  const releaseRes = await client.request({
    url: `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/releases?versionName=${versionName}`,
    method: 'POST'
  });

  console.log('🎉 SUCCESS! Site is LIVE at:');
  console.log(`👉 https://${SITE_ID}.web.app`);
  console.log(`👉 https://${SITE_ID}.firebaseapp.com`);
  console.log('Release name:', releaseRes.data.name);
}

deploy().catch((err) => {
  console.error('❌ Deployment error:', err.message, err.response?.data || '');
  process.exit(1);
});
