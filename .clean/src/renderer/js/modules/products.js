// Products Module
let allProducts = [], allCategories = [];

export async function render() {
  [allProducts, allCategories] = await Promise.all([api.products.getAll(), api.categories.getAll()]);
  renderPage();
}

function renderPage(filter='') {
  const q = String(filter || '').toLowerCase();
  const list = q ? allProducts.filter(p => (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)) : allProducts;
  const cats = allCategories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('page-content').innerHTML = `
    <div class="page-header">
      <h2>Products <span class="badge badge-gray">${allProducts.length}</span></h2>
      <div class="page-actions">
        <div class="search-bar"><input id="prod-search" placeholder="Search by name/code..." value="${filter}" /></div>
        <button class="btn btn-secondary" onclick="manageCategories()">📁 Categories</button>
        <button class="btn btn-secondary" onclick="downloadCSVTemplate()">⬇ CSV Template</button>
        <label class="btn btn-secondary" style="cursor:pointer;margin:0" title="Import products from CSV/Excel">
          📂 Import CSV
          <input type="file" id="csv-upload" accept=".csv,.xlsx,.xls" style="display:none" onchange="importProductsCSV(event)" />
        </label>
        <button class="btn btn-primary" onclick="showAddProduct()">+ Add Product</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Name</th><th>Code</th><th>Category</th><th>HSN</th><th>GST%</th><th>Purchase ₹</th><th>Selling ₹</th><th>Unit</th><th>Stock</th><th>Min.Stock</th><th>Actions</th></tr></thead>
          <tbody>${list.map((p,i)=>`
            <tr>
              <td>${i+1}</td>
              <td><strong>${p.name}</strong> ${p.is_service?'<span class="badge" style="background:var(--purple-bg);color:var(--purple);font-size:9px">SVC</span>':''}</td>
              <td>${p.code||'-'}</td>
              <td>${p.category_name||'-'}</td>
              <td>${p.hsn_code||'-'}</td>
              <td>${p.gst_percent}%</td>
              <td>${fmtCur(p.purchase_price)}</td>
              <td>${fmtCur(p.selling_price)}</td>
              <td>${p.unit}</td>
              <td><span class="badge ${p.stock<=p.min_stock&&p.min_stock>0?'badge-danger':'badge-success'}">${p.stock}</span></td>
              <td>${p.min_stock}</td>
              <td class="actions">
                <button class="btn btn-sm btn-secondary" onclick="editProduct(${p.id})">✏</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">🗑</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="12" class="text-center text-muted" style="padding:30px">No products found</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('prod-search').addEventListener('input', e=>renderPage(e.target.value));
}

// ─── CSV IMPORT ─────────────────────────────────────
window.downloadCSVTemplate = function() {
  const header = 'name,code,hsn_code,gst_percent,purchase_price,selling_price,unit,stock,min_stock,is_service';
  const example = 'Sample Product,PRD001,1234,18,100,150,Nos,50,5,0';
  const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'products_import_template.csv';
  a.click();
};

window.importProductsCSV = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) {
      toast('Import file too large. Use a file up to 2MB.', 'error');
      return;
    }
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', dense: true, cellFormula: false, cellHTML: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Convert sheet to array of objects. header=1 gives row arrays.
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length < 2) { toast('CSV file is empty or has no data rows', 'error'); return; }
    if (rows.length > 5001) { toast('Max 5000 rows per import allowed', 'error'); return; }

    // Map header row to indexes (case-insensitive)
    const headers = rows[0].map(h => String(h).trim().toLowerCase());
    const col = (name) => headers.indexOf(name);
    if (col('name') === -1) { toast('Missing required "name" column in import file', 'error'); return; }

    let imported = 0, skipped = 0;
    const cleanNum = (v, min = 0) => {
      const n = Number.parseFloat(v);
      if (!Number.isFinite(n)) return min;
      return Math.max(min, n);
    };
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row[col('name')] || '').trim();
      if (!name) { skipped++; continue; }
      const product = {
        name: name.slice(0, 120),
        code:           String(row[col('code')] || '').trim().slice(0, 80),
        hsn_code:       String(row[col('hsn_code')] || '').trim().slice(0, 40),
        gst_percent:    Math.min(28, cleanNum(row[col('gst_percent')], 0)),
        purchase_price: cleanNum(row[col('purchase_price')], 0),
        selling_price:  cleanNum(row[col('selling_price')], 0),
        unit:           String(row[col('unit')] || 'Nos').trim().slice(0, 20) || 'Nos',
        stock:          cleanNum(row[col('stock')], 0),
        min_stock:      cleanNum(row[col('min_stock')], 0),
        is_service:     Number.parseInt(row[col('is_service')], 10) ? 1 : 0,
        category_id:    null,
      };
      await api.products.add(product);
      imported++;
    }
    toast(`Import done: ${imported} products added${skipped ? ', ' + skipped + ' skipped' : ''}`, 'success');
    allProducts = await api.products.getAll();
    renderPage();
  } catch(e) {
    console.error('CSV import error', e);
    toast('Failed to import CSV: ' + e.message, 'error');
  } finally {
    // Reset file input so same file can be re-imported
    event.target.value = '';
  }
};

const UNITS = ['Nos','Kg','Gram','Litre','Ml','Box','Pack','Piece','Meter','Dozen'];
const GST_RATES = [0,3,5,12,18,28];

function productForm(p={}) {
  const catOpts = allCategories.map(c=>`<option value="${c.id}" ${p.category_id==c.id?'selected':''}>${c.name}</option>`).join('');
  const unitOpts = UNITS.map(u=>`<option ${p.unit===u?'selected':''}>${u}</option>`).join('');
  const gstOpts = GST_RATES.map(r=>`<option value="${r}" ${p.gst_percent==r?'selected':''}>${r}%</option>`).join('');
  return `<div class="form-grid">
    <div class="form-group"><label class="form-label">Product Name *</label><input class="form-control" id="pf-name" value="${p.name||''}" /></div>
    <div class="form-group"><label class="form-label">Product Code/Barcode</label><input class="form-control" id="pf-code" value="${p.code||''}" /></div>
    <div class="form-group"><label class="form-label">Category</label><select class="form-control" id="pf-cat"><option value="">None</option>${catOpts}</select></div>
    <div class="form-group"><label class="form-label">HSN Code</label><input class="form-control" id="pf-hsn" value="${p.hsn_code||''}" /></div>
    <div class="form-group"><label class="form-label">GST %</label><select class="form-control" id="pf-gst">${gstOpts}</select></div>
    <div class="form-group"><label class="form-label">Unit</label><select class="form-control" id="pf-unit">${unitOpts}</select></div>
    <div class="form-group"><label class="form-label">Purchase Price (₹)</label><input class="form-control" id="pf-pp" type="number" step="0.01" value="${p.purchase_price||0}" /></div>
    <div class="form-group"><label class="form-label">Selling Price (₹)</label><input class="form-control" id="pf-sp" type="number" step="0.01" value="${p.selling_price||0}" /></div>
    <div class="form-group"><label class="form-label">Opening Stock</label><input class="form-control" id="pf-stock" type="number" value="${p.stock||0}" /></div>
    <div class="form-group"><label class="form-label">Min. Stock Alert</label><input class="form-control" id="pf-min" type="number" value="${p.min_stock||0}" /></div>
    <div class="form-group full mt-2">
      <label class="form-label" style="display:flex;align-items:center;gap:8px;color:var(--purple);cursor:pointer;font-size:13px">
        <input type="checkbox" id="pf-is-service" ${p.is_service ? 'checked' : ''} style="width:16px;height:16px" />
        This is a Service (Stock tracking will be ignored for billing)
      </label>
    </div>
  </div>`;
}

function getProductData() {
  return {
    name: document.getElementById('pf-name').value.trim(),
    code: document.getElementById('pf-code').value,
    category_id: document.getElementById('pf-cat').value || null,
    hsn_code: document.getElementById('pf-hsn').value,
    gst_percent: parseFloat(document.getElementById('pf-gst').value)||0,
    unit: document.getElementById('pf-unit').value,
    purchase_price: parseFloat(document.getElementById('pf-pp').value)||0,
    selling_price: parseFloat(document.getElementById('pf-sp').value)||0,
    stock: parseFloat(document.getElementById('pf-stock').value)||0,
    min_stock: parseFloat(document.getElementById('pf-min').value)||0,
    is_service: document.getElementById('pf-is-service').checked ? 1 : 0
  };
}

window.showAddProduct = function() {
  openModal('Add Product', productForm(), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveProduct()">Save Product</button>`);
};
window.editProduct = function(id) {
  const p = allProducts.find(x=>x.id===id);
  openModal('Edit Product', productForm(p), `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveProduct(${id})">Update</button>`);
};
window.saveProduct = async function(id) {
  const data = getProductData();
  if (!data.name) { toast('Product name is required','error'); return; }
  if (id) { data.id=id; await api.products.update(data); toast('Product updated'); }
  else { await api.products.add(data); toast('Product added'); }
  closeModal();
  allProducts = await api.products.getAll();
  renderPage();
};
window.deleteProduct = async function(id) {
  if (!(await confirmModal('Delete Product', 'Are you sure you want to delete this product?'))) return;
  await api.products.delete(id);
  toast('Product deleted');
  allProducts = await api.products.getAll();
  renderPage();
};
window.manageCategories = function() {
  const list = allCategories.map(c=>`<div class="flex items-center justify-between" style="padding:6px 0;border-bottom:1px solid var(--gray-100)"><span>${c.name}</span><button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">🗑</button></div>`).join('');
  openModal('Manage Categories', `${list}<div class="flex gap-2 mt-3"><input class="form-control" id="new-cat" placeholder="Category name" /><button class="btn btn-primary" onclick="addCategory()">Add</button></div>`);
};
window.addCategory = async function() {
  const name = document.getElementById('new-cat').value.trim();
  if (!name) return;
  await api.categories.add(name);
  allCategories = await api.categories.getAll();
  window.manageCategories();
};
window.deleteCategory = async function(id) {
  await api.categories.delete(id);
  allCategories = await api.categories.getAll();
  window.manageCategories();
};
