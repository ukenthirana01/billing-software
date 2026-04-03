// Bill Scanner Module with Tesseract.js (Offline)

// ─── UTILS & PREPROCESSING ────────────────────────────────
// Convert colored image to high contrast grayscale before OCR
function preprocessImage(imgElement) {
  const canvas = document.createElement('canvas');
  canvas.width = imgElement.width;
  canvas.height = imgElement.height;
  const ctx = canvas.getContext('2d');
  
  // Draw original image
  ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
  
  // Grayscale and contrast pass
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Grayscale (luminosity method)
    let gray = (0.299 * r) + (0.587 * g) + (0.114 * b);
    
    // Increase contrast (thresholding style)
    if (gray > 140) {
      gray = 255;
    } else {
      gray = Math.max(0, gray - 50);
    }
    
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ─── BILL PARSER ──────────────────────────────────────────
// Simple line-based parser looking for numbers and item descriptions
function parseBillText(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 3);
  const items = [];
  
  // Standard Regex for matching an item row:
  // Usually looks like: [Description] [Qty] [Price] [Amounts...]
  // Examples: 
  // "Apple 2 50.00 100.00"
  // "1. Keyboard 1 500 500"
  const rowPattern = /([A-Za-z0-9\s\-&]+?)[\s]+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i;

  lines.forEach(line => {
    // Avoid headers/totals lines
    const lowLine = line.toLowerCase();
    if (lowLine.includes('total') || lowLine.includes('gst') || lowLine.includes('invoice') || lowLine.includes('balance') || lowLine.includes('cash')) {
      return;
    }

    const match = line.match(rowPattern);
    if (match) {
      let desc = match[1].trim();
      
      // Clean up description (remove leading numbers/bullet points if any)
      desc = desc.replace(/^[\d\.\-\)]+\s*/, '').trim();

      if (desc.length > 2 && !/^\d+$/.test(desc)) {
        const qty = parseFloat(match[2]) || 1;
        const price = parseFloat(match[3]) || 0;
        
        items.push({
          product_name: desc,
          qty: qty,
          price: price,
          gst_percent: 0 // Default, user can edit
        });
      }
    }
  });

  return items;
}

// ─── UI & LOGIC ────────────────────────────────────────────
export function openScanner(onImportItemsCallback) {
  // Ensure modal structure
  const modalBox = document.getElementById('modal-box');
  const modalOverlay = document.getElementById('modal-overlay');

  modalBox.style.maxWidth = '900px';
  modalBox.innerHTML = `
    <div class="modal-header">
      <span class="modal-title"><i class="bi bi-camera" style="margin-right:6px"></i> Scan Purchase Bill</span>
      <button class="modal-close" onclick="closeScanner()"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="modal-body" style="display:flex; gap:20px; flex-direction:column; min-height: 480px;">
      
      <!-- Input Selection -->
      <div style="display:flex; justify-content:center; gap:16px;">
        <button class="btn btn-secondary" onclick="startWebcam()"><i class="bi bi-webcam"></i> Use Camera</button>
        <div style="position:relative">
          <input type="file" id="scan-file-input" accept="image/*" style="opacity:0; position:absolute; inset:0; cursor:pointer;" onchange="handleFileUpload(event)">
          <button class="btn btn-secondary"><i class="bi bi-image"></i> Upload Image</button>
        </div>
      </div>

      <!-- Preview Area -->
      <div id="scan-preview-container" style="flex:1; background:var(--gray-100); border-radius:12px; border:2px dashed var(--gray-300); display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;">
        <div id="scan-placeholder" style="color:var(--gray-500); text-align:center;">
          <i class="bi bi-receipt" style="font-size:48px;"></i>
          <p>Camera feed or image will appear here</p>
        </div>
        
        <video id="scan-video" autoplay playsinline style="display:none; max-width:100%; max-height:100%;"></video>
        <img id="scan-image" style="display:none; max-width:100%; max-height:100%; object-fit:contain;"/>
        
        <!-- Capture Overlay -->
        <div id="capture-overlay" style="display:none; position:absolute; bottom:20px; left:0; right:0; text-align:center;">
           <button class="btn btn-primary" onclick="captureAndScan()" style="padding:16px 32px; font-size:18px; border-radius:30px; box-shadow:0 8px 16px rgba(0,0,0,0.2);"><i class="bi bi-camera-fill"></i> Read Selected Image</button>
        </div>
      </div>

      <!-- Progress Section -->
      <div id="scan-progress-area" style="display:none;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px; font-weight:600; color:var(--primary-700)">
          <span id="scan-status-text">Initializing OCR Engine...</span>
          <span id="scan-progress-pct">0%</span>
        </div>
        <div style="height:8px; background:var(--gray-200); border-radius:4px; overflow:hidden;">
          <div id="scan-progress-bar" style="height:100%; width:0%; background:var(--primary-600); transition:width 0.2s;"></div>
        </div>
        <p style="font-size:11px; color:var(--gray-500); margin-top:8px; text-align:center;"><i class="bi bi-info-circle"></i> On first run, OCR language files will download (requires internet). Afterwards, scanning is 100% offline.</p>
      </div>

      <!-- Review Table Section -->
      <div id="scan-review-area" style="display:none;">
        <h4 style="margin-bottom:12px; font-weight:700;">Parsed Items (Review & Correct)</h4>
        <table class="billing-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="width:100px;">Qty</th>
              <th style="width:120px;">Unit Price</th>
              <th style="width:100px;">GST %</th>
            </tr>
          </thead>
          <tbody id="scan-review-tbody"></tbody>
        </table>
        <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:20px;">
          <button class="btn btn-secondary" onclick="resetScanner()">Rescan</button>
          <button class="btn btn-success" onclick="importScannedItems()"><i class="bi bi-check2-circle"></i> Import to Bill</button>
        </div>
      </div>

    </div>
  `;

  modalOverlay.classList.remove('hidden');
  
  // Store globals for this session
  window.importScannedItemsCallback = onImportItemsCallback;
  window.scannedItems = [];
  window.scannerStream = null;
}

window.closeScanner = function() {
  document.getElementById('modal-overlay').classList.add('hidden');
  stopWebcam();
}

window.startWebcam = async function() {
  const video = document.getElementById('scan-video');
  const img = document.getElementById('scan-image');
  const placeholder = document.getElementById('scan-placeholder');
  const overlay = document.getElementById('capture-overlay');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    window.scannerStream = stream;
    video.srcObject = stream;
    
    img.style.display = 'none';
    placeholder.style.display = 'none';
    video.style.display = 'block';
    overlay.style.display = 'block';
    
    document.getElementById('scan-review-area').style.display = 'none';
    document.getElementById('scan-progress-area').style.display = 'none';
    
  } catch(err) {
    toast('Camera access denied or unavailable.', 'error');
    console.error(err);
  }
}

window.stopWebcam = function() {
  if (window.scannerStream) {
    window.scannerStream.getTracks().forEach(track => track.stop());
    window.scannerStream = null;
  }
}

window.handleFileUpload = function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    stopWebcam();
    
    const video = document.getElementById('scan-video');
    const img = document.getElementById('scan-image');
    const placeholder = document.getElementById('scan-placeholder');
    const overlay = document.getElementById('capture-overlay');

    video.style.display = 'none';
    placeholder.style.display = 'none';
    img.src = ev.target.result;
    img.style.display = 'block';
    overlay.style.display = 'block';
    
    document.getElementById('scan-review-area').style.display = 'none';
    document.getElementById('scan-progress-area').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

window.captureAndScan = function() {
  document.getElementById('capture-overlay').style.display = 'none';
  document.getElementById('scan-progress-area').style.display = 'block';
  
  const video = document.getElementById('scan-video');
  const img = document.getElementById('scan-image');
  
  let targetImage = null;
  
  // If video is active, snapshot it to an image
  if (video.style.display === 'block') {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    img.src = canvas.toDataURL('image/png');
    
    stopWebcam();
    video.style.display = 'none';
    img.style.display = 'block';
    targetImage = img;
  } else {
    targetImage = img;
  }
  
  // Give DOM a frame to update, then scan
  setTimeout(() => {
    performOCR(targetImage);
  }, 100);
}

async function performOCR(imgElement) {
  if (!window.Tesseract) {
    toast('Tesseract Engine not loaded!', 'error');
    return;
  }

  // Preprocess for better readable contrast
  const optimizedCanvas = preprocessImage(imgElement);

  const statusText = document.getElementById('scan-status-text');
  const progressPct = document.getElementById('scan-progress-pct');
  const progressBar = document.getElementById('scan-progress-bar');
  
  try {
    const worker = await window.Tesseract.createWorker('eng', 1, {
      workerPath: '../../node_modules/tesseract.js/dist/worker.min.js',
      corePath: '../../node_modules/tesseract.js-core/tesseract-core.wasm.js',
      logger: m => {
        if (m.status === 'recognizing text') {
          statusText.textContent = 'Reading text from image...';
          const pct = Math.floor(m.progress * 100);
          progressPct.textContent = `${pct}%`;
          progressBar.style.width = `${pct}%`;
        } else {
          statusText.textContent = m.status;
        }
      }
    });
    
    const result = await worker.recognize(optimizedCanvas);
    await worker.terminate();
    
    document.getElementById('scan-progress-area').style.display = 'none';
    
    // Parse result
    const parsedItems = parseBillText(result.data.text);
    if (parsedItems.length === 0) {
      toast('No recognizable product table found. Please try a clearer image.', 'warning');
      resetScanner();
      return;
    }
    
    window.scannedItems = parsedItems;
    showReviewTable();
    
  } catch (err) {
    console.error('OCR Error:', err);
    toast('Error parsing image. Please try again.', 'error');
    document.getElementById('scan-progress-area').style.display = 'none';
    document.getElementById('capture-overlay').style.display = 'block';
  }
}

function showReviewTable() {
  document.getElementById('scan-review-area').style.display = 'block';
  const tbody = document.getElementById('scan-review-tbody');
  
  tbody.innerHTML = window.scannedItems.map((item, i) => `
    <tr>
      <td><input type="text" class="form-control" value="${window.escapeHtml ? window.escapeHtml(item.product_name) : item.product_name}" id="scan-item-desc-${i}" /></td>
      <td><input type="number" class="form-control" value="${item.qty}" id="scan-item-qty-${i}" step="0.01" /></td>
      <td><input type="number" class="form-control" value="${item.price}" id="scan-item-price-${i}" step="0.01" /></td>
      <td>
        <select class="form-control" id="scan-item-gst-${i}">
          <option value="0" ${item.gst_percent==0?'selected':''}>0%</option>
          <option value="5" ${item.gst_percent==5?'selected':''}>5%</option>
          <option value="12" ${item.gst_percent==12?'selected':''}>12%</option>
          <option value="18" ${item.gst_percent==18?'selected':''}>18%</option>
          <option value="28" ${item.gst_percent==28?'selected':''}>28%</option>
        </select>
      </td>
    </tr>
  `).join('');
}

window.resetScanner = function() {
  document.getElementById('scan-review-area').style.display = 'none';
  document.getElementById('capture-overlay').style.display = 'block';
}

window.importScannedItems = function() {
  const finalItems = [];
  
  // Scrape table inputs to save user edits
  for (let i = 0; i < window.scannedItems.length; i++) {
    const descInput = document.getElementById(`scan-item-desc-${i}`);
    if (!descInput) break;
    
    const desc = descInput.value.trim();
    const qty = parseFloat(document.getElementById(`scan-item-qty-${i}`).value) || 1;
    const price = parseFloat(document.getElementById(`scan-item-price-${i}`).value) || 0;
    const gst = parseFloat(document.getElementById(`scan-item-gst-${i}`).value) || 0;
    
    if (desc) {
      finalItems.push({
        product_name: desc,
        qty: qty,
        price: price,
        gst_percent: gst
      });
    }
  }
  
  if (finalItems.length === 0) {
    toast('No items to import.', 'warning');
    return;
  }
  
  if (typeof window.importScannedItemsCallback === 'function') {
    window.importScannedItemsCallback(finalItems);
  }
  
  closeScanner();
  toast('Items imported successfully!', 'success');
}
