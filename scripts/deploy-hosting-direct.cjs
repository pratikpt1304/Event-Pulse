const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const siteId = 'eventpulse-su-34a42';
const distDir = path.join(__dirname, '..', 'dist');

const zlib = require('zlib');

function getSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getAllFiles(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, baseDir));
    } else {
      const relPath = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ fullPath, relPath });
    }
  });
  return results;
}

async function getAccessToken() {
  const token = await admin.app().options.credential.getAccessToken();
  return token.access_token;
}

async function deploy() {
  console.log(`🚀 Starting direct deployment to Firebase Hosting site: ${siteId}...`);

  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ directory not found! Run npm run build first.');
  }

  const token = await getAccessToken();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 1. Create a new version
  console.log('📦 Step 1: Creating new Hosting Version...');
  const createRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${siteId}/versions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      config: {
        headers: [
          {
            glob: "**",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate"
            }
          }
        ]
      }
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create version (${createRes.status}): ${errText}`);
  }

  const versionData = await createRes.json();
  const versionName = versionData.name;
  console.log(`✅ Version created: ${versionName}`);

  // 2. Hash gzipped files
  console.log('🔍 Step 2: Gzipping and hashing dist/ files...');
  const filesList = getAllFiles(distDir);
  const filesMap = {};
  const gzippedBuffers = {};

  for (const f of filesList) {
    const rawBuf = fs.readFileSync(f.fullPath);
    const gzBuf = zlib.gzipSync(rawBuf, { level: 9 });
    const hash = getSha256(gzBuf);
    filesMap[f.relPath] = hash;
    gzippedBuffers[hash] = gzBuf;
  }
  console.log(`Found ${filesList.length} files compressed and indexed.`);

  // 3. Populate files
  console.log('📤 Step 3: Populating files on Firebase Hosting...');
  const popRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ files: filesMap })
  });

  if (!popRes.ok) {
    const errText = await popRes.text();
    throw new Error(`Failed to populate files (${popRes.status}): ${errText}`);
  }

  const popData = await popRes.json();
  const uploadUrl = popData.uploadUrl;
  const requiredHashes = popData.uploadRequiredHashes || [];
  console.log(`Files requiring upload: ${requiredHashes.length}`);

  // 4. Upload required hashes
  for (let i = 0; i < requiredHashes.length; i++) {
    const hash = requiredHashes[i];
    const buf = gzippedBuffers[hash];
    console.log(`Uploading [${i + 1}/${requiredHashes.length}] (${Math.round(buf.length / 1024)} KB) hash: ${hash.slice(0, 10)}...`);

    let uploaded = false;
    let attempts = 0;
    while (!uploaded && attempts < 3) {
      attempts++;
      try {
        const upRes = await fetch(`${uploadUrl}/${hash}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(buf.length)
          },
          body: buf,
          duplex: 'half'
        });

        if (!upRes.ok) {
          const errText = await upRes.text();
          throw new Error(`Upload failed (${upRes.status}): ${errText}`);
        }
        uploaded = true;
      } catch (err) {
        console.warn(`Retry attempt ${attempts} for ${hash.slice(0, 10)}: ${err.message}`);
        if (attempts >= 3) throw err;
        await new Promise(r => setTimeout(r, 1000 * attempts));
      }
    }
  }

  // 5. Finalize version
  console.log('🔒 Step 4: Finalizing version status to FINALIZED...');
  const finRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/${versionName}?update_mask=status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'FINALIZED' })
  });

  if (!finRes.ok) {
    const errText = await finRes.text();
    throw new Error(`Failed to finalize version (${finRes.status}): ${errText}`);
  }

  // 6. Release version
  console.log('🎉 Step 5: Releasing new version to production CDN...');
  const relRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${siteId}/releases?versionName=${encodeURIComponent(versionName)}`, {
    method: 'POST',
    headers
  });

  if (!relRes.ok) {
    const errText = await relRes.text();
    throw new Error(`Failed to release version (${relRes.status}): ${errText}`);
  }

  console.log('🌟 Deployment Successful!');
  console.log(`🌐 Live URL: https://${siteId}.web.app`);
  process.exit(0);
}

deploy().catch(err => {
  console.error('❌ Deployment Error:', err.message);
  process.exit(1);
});
