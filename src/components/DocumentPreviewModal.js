/**
 * In-App Interactive Document Preview Modal
 * Universal Multi-Browser PDF Canvas Engine (Vite Bundled PDF.js)
 */

import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';

if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

export function openDocumentPreviewModal({ title = 'Campus Document', fileName, name, dataUrl, mimeType, type }) {
  const docFileName = fileName || name || 'Notice_Document.pdf';
  const docMimeType = mimeType || type || 'application/pdf';
  const existing = document.getElementById('doc-preview-modal-root');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'doc-preview-modal-root';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position: fixed; inset: 0; z-index: 100000; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 1rem;';

  let blobUrl = dataUrl || '';
  let isPdf = (docMimeType && docMimeType.includes('pdf')) || (docFileName && docFileName.toLowerCase().endsWith('.pdf')) || (dataUrl && dataUrl.startsWith('data:application/pdf'));
  let pdfDataUint8 = null;

  if (dataUrl && dataUrl.startsWith('data:')) {
    try {
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || docMimeType;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      pdfDataUint8 = new Uint8Array(n);
      while (n--) {
        pdfDataUint8[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([pdfDataUint8], { type: mime || 'application/pdf' });
      blobUrl = URL.createObjectURL(blob);
      if (mime.includes('pdf')) isPdf = true;
    } catch (e) {
      console.warn('Blob conversion warning:', e);
    }
  }

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 960px; width: 95%; height: 90vh; max-height: 90vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 18px; box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.7); background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.15);">
      
      <!-- Top Control Bar -->
      <div style="padding: 0.85rem 1.25rem; background: #090d16; color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1); flex-wrap: wrap; gap: 0.5rem; flex-shrink: 0; z-index: 10;">
        <div style="display: flex; align-items: center; gap: 0.75rem; overflow: hidden; flex: 1; min-width: 180px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
            ${isPdf ? '📄' : '🖼️'}
          </div>
          <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <div style="font-size: 0.95rem; font-weight: 800; color: #ffffff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.01em;">
              ${docFileName}
            </div>
            <div style="font-size: 0.725rem; color: #94a3b8; font-weight: 500;">
              ${title} • Official Campus Document
            </div>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <a href="${blobUrl}" download="${docFileName}" target="_blank" class="btn btn-sm btn-primary" style="font-size: 0.775rem; padding: 0.4rem 0.85rem; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; background: linear-gradient(135deg, #7c3aed, #06b6d4); border: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35); color: #fff;">
            📥 Download File
          </a>
          <button id="btn-close-doc-preview" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #ffffff; font-size: 1.1rem; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s;">
            ✕
          </button>
        </div>
      </div>

      <!-- Live Viewer Area -->
      <div style="flex: 1; background: #0f172a; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 1.25rem; position: relative;">
        ${isPdf ? `
          <div id="pdf-canvas-container" style="width: 100%; display: flex; flex-direction: column; align-items: center; gap: 1.5rem;">
            <div id="pdf-loading-spinner" style="color: #94a3b8; font-size: 0.9rem; margin-top: 4rem; text-align: center;">
              <div style="font-size: 2.5rem; margin-bottom: 0.75rem; animation: pulse 1.5s infinite;">📄</div>
              <strong>Rendering official document pages...</strong>
            </div>
          </div>
        ` : `
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
            <img src="${blobUrl}" alt="${docFileName}" onerror="this.onerror=null;this.parentElement.innerHTML='<div style=\\'color:#94a3b8;font-size:0.9rem;padding:2rem;text-align:center;\\'>Preview not available for this image format.</div>';" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 12px; box-shadow: 0 15px 40px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);" />
          </div>
        `}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Render PDF pages on HTML5 Canvas using PDF.js
  if (isPdf) {
    (async () => {
      const containerEl = modal.querySelector('#pdf-canvas-container');
      const spinner = modal.querySelector('#pdf-loading-spinner');

      try {
        const loadingTask = pdfDataUint8 
          ? pdfjsLib.getDocument({ data: pdfDataUint8 })
          : pdfjsLib.getDocument(blobUrl);

        const pdf = await loadingTask.promise;
        if (spinner) spinner.remove();

        const modalContainer = modal.querySelector('.modal-container');
        const containerW = modalContainer ? (modalContainer.clientWidth - 48) : (window.innerWidth - 64);
        const targetWidth = Math.max(300, Math.min(840, containerW));

        // High-DPI / Retina super-sampling multiplier (2.5x minimum) for razor-sharp, crystal-clear text
        const dpr = Math.max(2.5, (window.devicePixelRatio || 1) * 1.5);

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const unscaled = page.getViewport({ scale: 1.0 });
          const cssScale = (targetWidth / unscaled.width) || 1.0;
          const cssViewport = page.getViewport({ scale: cssScale });
          const renderViewport = page.getViewport({ scale: cssScale * dpr });

          const pageWrapper = document.createElement('div');
          pageWrapper.style.cssText = 'width: 100%; max-width: ' + Math.floor(cssViewport.width) + 'px; box-shadow: 0 15px 40px rgba(0,0,0,0.6); border-radius: 12px; overflow: hidden; background: #ffffff; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0;';

          // Page Badge Indicator (e.g. Page 1 of 2)
          const pageBadge = document.createElement('div');
          pageBadge.style.cssText = 'width: 100%; background: #090d16; color: #94a3b8; font-size: 0.75rem; font-weight: 700; padding: 0.45rem 0.75rem; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08); text-transform: uppercase; letter-spacing: 0.05em;';
          pageBadge.innerHTML = `📄 Page ${i} of ${pdf.numPages}`;
          pageWrapper.appendChild(pageBadge);

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });
          canvas.width = Math.floor(renderViewport.width);
          canvas.height = Math.floor(renderViewport.height);
          canvas.style.cssText = 'width: 100%; height: auto; display: block; margin: 0 auto; border: none;';

          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';

          pageWrapper.appendChild(canvas);
          containerEl.appendChild(pageWrapper);

          await page.render({
            canvasContext: context,
            viewport: renderViewport
          }).promise;
        }
        return;
      } catch (renderErr) {
        console.warn('PDF.js canvas render warning:', renderErr);
        if (spinner) spinner.remove();
        if (containerEl) {
          containerEl.innerHTML = `
            <object data="${blobUrl}" type="application/pdf" style="width: 100%; height: 75vh; border: none; border-radius: 10px;">
              <embed src="${blobUrl}" type="application/pdf" style="width: 100%; height: 75vh; border: none;" />
            </object>
          `;
        }
      }
    })();
  }

  const close = () => {
    modal.remove();
    if (blobUrl && blobUrl.startsWith('blob:')) {
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    }
  };

  modal.querySelector('#btn-close-doc-preview')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}
