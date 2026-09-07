const state = {
  settings: null,
  customers: [],
  catalog: [],
  editor: null,
  validation: null,
  documentFilter: 'all'
};

const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modalRoot');
const printLayer = document.querySelector('#printLayer');

const icons = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2.8h8l4 4V21H6z"/><path d="M14 3v5h4M9 12h6M9 16h6"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.3-4 2.1-6 5.5-6s5.2 2 5.5 6M16 5.5a3 3 0 0 1 0 5.8M16 14c2.8.2 4.3 1.9 4.5 5"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4.5A3.5 3.5 0 0 1 7.5 3H11v17H7.5A3.5 3.5 0 0 0 4 21.5zM20 4.5A3.5 3.5 0 0 0 16.5 3H13v17h3.5a3.5 3.5 0 0 1 3.5 1.5z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2.8 20 6v5.7c0 4.8-3.2 8-8 9.5-4.8-1.5-8-4.7-8-9.5V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/><path d="M17 11h.01"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 16-.8 4.8L8 20l11-11-4-4zM13.5 6.5l4 4"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>'
};

document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icons[el.dataset.icon] || ''; });

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function money(cents = 0, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(Number(cents) / 100).replace('$', 'US$');
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const d = new Date(`${dateString}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || 'Request failed'), { status: response.status, details: body.details });
  return body;
}

function toast(message, type = '') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  document.querySelector('#toastRoot').append(node);
  setTimeout(() => node.remove(), 3600);
}

function setActiveNav(key) {
  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === key));
}

function pageHead(eyebrow, title, description, actions = '') {
  return `<div class="page-head"><div><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="head-actions">${actions}</div></div>`;
}

function documentRows(documents, compact = false) {
  if (!documents.length) return `<div class="empty-state"><div class="empty-icon">${icons.file}</div><h3>No documents yet</h3><p>Create the first document to get started.</p><a class="button button-primary" href="#/document/new?type=quote">New quotation</a></div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th>Status</th><th class="amount">Total</th><th></th></tr></thead><tbody>
    ${documents.map(doc => `<tr>
      <td><div class="doc-cell"><span class="doc-icon">${doc.type === 'invoice' ? icons.receipt : icons.file}</span><span><strong>${escapeHtml(doc.number)}</strong><small>${doc.type === 'invoice' ? 'Invoice' : 'Quotation'}${doc.order_ref ? ` · ${escapeHtml(doc.order_ref)}` : ''}</small></span></div></td>
      <td>${escapeHtml(doc.company_name)}</td>
      <td class="muted">${formatDate(doc.issue_date)}</td>
      <td><span class="badge badge-${doc.status}">${escapeHtml(doc.status)}</span></td>
      <td class="amount">${money(doc.total_cents)}</td>
      <td><a class="icon-button" href="#/document/${doc.id}" aria-label="Open ${escapeHtml(doc.number)}">${icons.arrow}</a></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

async function renderOverview() {
  setActiveNav('overview');
  const { stats, recent } = await api('/api/dashboard');
  app.innerHTML = `
    ${pageHead('AAXAL Office', 'Good day, Safiyyah', 'Create, verify and issue commercial documents from one place.', `<a class="button button-ghost" href="#/document/new?type=invoice">${icons.receipt} New invoice</a><a class="button button-primary" href="#/document/new?type=quote">${icons.plus} New quotation</a>`)}
    <section class="stats-grid">
      ${statCard('Quotations', stats.quotes, 'file', 'All records')}
      ${statCard('Invoices', stats.invoices, 'receipt', 'All records')}
      ${statCard('Drafts', stats.drafts, 'edit', 'Need attention')}
      ${statCard('Customers', stats.customers, 'users', 'Searchable directory')}
    </section>
    <section class="overview-grid">
      <div class="card"><div class="card-head"><h2>Recent documents</h2><a class="text-link" href="#/quotes">View all</a></div>${documentRows(recent, true)}</div>
      <aside class="assurance-card card"><div class="assurance-icon">${icons.shield}</div><h2>Price assurance</h2><p>Finalisation checks every catalogue-linked line against the official 2026 price book.</p><div class="assurance-list"><span><i class="check">✓</i>10 verified personnel rates</span><span><i class="check">✓</i>Custom rates require a reason</span><span><i class="check">✓</i>Final documents are locked</span></div></aside>
    </section>`;
}

function statCard(label, value, iconName, hint) {
  return `<article class="stat-card"><div class="stat-top"><span class="stat-icon">${icons[iconName]}</span><span class="trend">Live</span></div><strong>${Number(value).toLocaleString()}</strong><p>${escapeHtml(label)} · ${escapeHtml(hint)}</p></article>`;
}

async function renderDocuments(type) {
  const nav = type === 'invoice' ? 'invoices' : 'quotes';
  setActiveNav(nav);
  const params = new URLSearchParams({ type });
  if (state.documentFilter !== 'all') params.set('status', state.documentFilter);
  const documents = await api(`/api/documents?${params}`);
  const singular = type === 'invoice' ? 'invoice' : 'quotation';
  app.innerHTML = `
    ${pageHead('Documents', type === 'invoice' ? 'Invoices' : 'Quotations', `Manage every ${singular} from draft to final issue.`, `<a class="button button-primary" href="#/document/new?type=${type}">${icons.plus} New ${singular}</a>`)}
    <div class="toolbar"><div class="search-box"><span class="field-icon">${icons.search}</span><input id="documentSearch" type="search" placeholder="Search number, company or order reference…"></div><div class="filter-tabs" id="documentFilters"><button class="${state.documentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button><button class="${state.documentFilter === 'draft' ? 'active' : ''}" data-filter="draft">Draft</button><button class="${state.documentFilter === 'finalised' ? 'active' : ''}" data-filter="finalised">Finalised</button></div></div>
    <div class="card" id="documentTable">${documentRows(documents)}</div>`;
  document.querySelector('#documentSearch').addEventListener('input', debounce(async event => {
    params.set('q', event.target.value);
    document.querySelector('#documentTable').innerHTML = documentRows(await api(`/api/documents?${params}`));
  }, 220));
  document.querySelector('#documentFilters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.documentFilter = button.dataset.filter;
    renderDocuments(type);
  });
}

async function renderCustomers(query = '') {
  setActiveNav('customers');
  const customers = await api(`/api/customers?q=${encodeURIComponent(query)}`);
  app.innerHTML = `
    ${pageHead('Directory', 'Customers', 'Search instantly by company name or telephone number.', `<button class="button button-primary" data-action="new-customer">${icons.plus} Add customer</button>`)}
    <div class="toolbar"><div class="search-box"><span class="field-icon">${icons.search}</span><input id="customerSearch" type="search" value="${escapeHtml(query)}" placeholder="Search company name or telephone…"></div></div>
    <div class="card" id="customerTable">${customerTable(customers)}</div>`;
  document.querySelector('#customerSearch').addEventListener('input', debounce(async event => {
    const results = await api(`/api/customers?q=${encodeURIComponent(event.target.value)}`);
    document.querySelector('#customerTable').innerHTML = customerTable(results);
  }, 220));
}

function customerTable(customers) {
  if (!customers.length) return `<div class="empty-state"><div class="empty-icon">${icons.users}</div><h3>No matching customers</h3><p>Try another name or telephone number.</p></div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Company</th><th>Telephone</th><th>Address</th><th>Contact</th><th>Documents</th><th></th></tr></thead><tbody>
    ${customers.map(customer => `<tr><td><div class="customer-name"><span class="customer-avatar">${initials(customer.company_name)}</span><span><strong>${escapeHtml(customer.company_name)}</strong><small>${escapeHtml(customer.email || 'No email')}</small></span></div></td><td>${escapeHtml(customer.telephone || '—')}</td><td class="muted">${escapeHtml([customer.address1, customer.address2].filter(Boolean).join(', ') || '—')}</td><td>${escapeHtml(customer.attention || '—')}</td><td>${customer.document_count || 0}</td><td><button class="icon-button" data-action="edit-customer" data-id="${customer.id}" aria-label="Edit customer">${icons.edit}</button></td></tr>`).join('')}
  </tbody></table></div>`;
}

async function renderCatalog(query = '') {
  setActiveNav('catalog');
  const catalog = await api(`/api/catalog?q=${encodeURIComponent(query)}`);
  app.innerHTML = `
    ${pageHead('Commercial controls', '2026 price book', 'The authoritative personnel rates used during finalisation.')}
    <div class="source-note">${icons.info}<span>Imported from <strong>AAXAL OS Price List 2026.pdf</strong>. Catalogue-linked document lines must match these rates exactly before they can be finalised.</span></div>
    <div class="toolbar"><div class="search-box"><span class="field-icon">${icons.search}</span><input id="catalogSearch" type="search" value="${escapeHtml(query)}" placeholder="Search rate or code…"></div></div>
    <div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Code</th><th>Description</th><th>Category</th><th>Unit</th><th>Source</th><th class="amount">Rate</th></tr></thead><tbody>
      ${catalog.map(item => `<tr><td><strong>${escapeHtml(item.code)}</strong></td><td>${escapeHtml(item.name)}</td><td class="muted">${escapeHtml(item.category)}</td><td>${escapeHtml(item.unit)}</td><td class="muted">2026 PDF</td><td class="amount rate">${money(item.rate_cents)}</td></tr>`).join('')}
    </tbody></table></div></div>`;
  document.querySelector('#catalogSearch').addEventListener('input', debounce(event => renderCatalog(event.target.value), 220));
}

const quoteTerms = `1. NDT Level III services are excluded. If required, they will be offered at US$400 per hour and invoiced separately.
2. This quotation is valid for one calendar month from the date of submission.
3. Personnel day rates and equipment hire are invoiced door-to-door from mobilisation to demobilisation.
4. Additional hours outside the agreed shift will be invoiced pro-rata.
5. All invoiced amounts are in United States Dollars unless otherwise agreed in writing.`;

const invoiceTerms = `Please arrange payment into the AAXAL Offshore Services Limited account using the bank details shown below. Please include the invoice number as the payment reference.`;

async function newDocument(type, source = null) {
  const { number } = await api(`/api/documents/next-number?type=${type}`);
  const today = isoDate();
  state.validation = null;
  state.editor = {
    id: null,
    type,
    number,
    status: 'draft',
    customer_id: source?.customer_id || state.customers[0]?.id || '',
    issue_date: today,
    valid_until: type === 'quote' ? addDays(today, 30) : '',
    due_date: type === 'invoice' ? addDays(today, 30) : '',
    order_ref: source?.order_ref || '',
    quotation_ref: type === 'invoice' && source ? source.number : '',
    po_date: '',
    vat_rate: Number(source?.vat_rate ?? 7.5),
    terms: type === 'quote' ? (source?.terms || quoteTerms) : invoiceTerms,
    notes: '',
    lines: source?.lines?.map(line => ({
      catalog_item_id: line.catalog_item_id || null,
      code: line.code,
      description: line.description,
      unit: line.unit,
      quantity: line.quantity,
      unit_price_cents: line.unit_price_cents,
      custom_reason: line.custom_reason || (line.catalog_item_id ? '' : 'Rate carried forward from approved quotation')
    })) || [catalogLine(state.catalog[0])]
  };
  renderEditor();
}

function catalogLine(item) {
  return { catalog_item_id: item?.id || null, code: item?.code || '', description: item?.name || '', unit: item?.unit || 'day', quantity: 1, unit_price_cents: item?.rate_cents || 0, custom_reason: '' };
}

async function loadDocument(id) {
  state.validation = null;
  state.editor = await api(`/api/documents/${id}`);
  renderEditor();
}

function renderEditor() {
  const doc = state.editor;
  const locked = doc.status === 'finalised';
  setActiveNav(doc.type === 'invoice' ? 'invoices' : 'quotes');
  const singular = doc.type === 'invoice' ? 'Invoice' : 'Quotation';
  const subtotal = doc.lines.reduce((sum, line) => sum + Math.round(Number(line.quantity || 0) * Number(line.unit_price_cents || 0)), 0);
  const vat = Math.round(subtotal * Number(doc.vat_rate || 0) / 100);
  const total = subtotal + vat;
  app.innerHTML = `
    ${pageHead(doc.id ? `${singular} · ${doc.status}` : `New ${singular.toLowerCase()}`, doc.number || singular, locked ? `Finalised ${formatDate(doc.issue_date)} · Price checked and locked` : 'Complete the details, save a draft, then verify and finalise.', `<a class="button button-ghost" href="#/${doc.type === 'invoice' ? 'invoices' : 'quotes'}">Close</a>${doc.id ? `<button class="button button-secondary" data-action="preview">${icons.print} Preview</button>` : ''}`)}
    ${locked ? `<div class="locked-note">${icons.shield} Price book verified ${doc.price_checked_at ? `on ${new Date(doc.price_checked_at).toLocaleString('en-GB')}` : ''}. This document is locked.</div>` : ''}
    ${validationHtml(state.validation)}
    <div class="editor-layout">
      <div class="card editor-card">
        <section class="section"><div class="section-title"><div><h2>Document details</h2><p>References and commercial dates</p></div><span class="badge badge-${doc.status}">${doc.status}</span></div>
          <div class="form-grid cols-3">
            ${field('Document number', 'number', doc.number, 'text', locked)}
            ${field('Issue date', 'issue_date', doc.issue_date, 'date', locked)}
            ${field(doc.type === 'quote' ? 'Valid until' : 'Due date', doc.type === 'quote' ? 'valid_until' : 'due_date', doc.type === 'quote' ? doc.valid_until : doc.due_date, 'date', locked)}
            ${field('Order reference', 'order_ref', doc.order_ref, 'text', locked)}
            ${doc.type === 'invoice' ? field('Quotation reference', 'quotation_ref', doc.quotation_ref, 'text', locked) : ''}
            ${doc.type === 'invoice' ? field('PO date', 'po_date', doc.po_date, 'date', locked) : ''}
          </div>
        </section>
        <section class="section"><div class="section-title"><div><h2>Customer</h2><p>Billing recipient and contact</p></div>${!locked ? `<button class="text-link" data-action="new-customer">+ Add customer</button>` : ''}</div>
          <div class="field"><label>Company <span class="required">*</span></label><select data-doc-field="customer_id" ${locked ? 'disabled' : ''}>${state.customers.map(c => `<option value="${c.id}" ${Number(doc.customer_id) === Number(c.id) ? 'selected' : ''}>${escapeHtml(c.company_name)}${c.telephone ? ` · ${escapeHtml(c.telephone)}` : ''}</option>`).join('')}</select></div>
          ${customerSummary(doc.customer_id)}
        </section>
        <section class="section"><div class="section-title"><div><h2>Line items</h2><p>Use the price book wherever a controlled rate applies</p></div></div>
          <div class="table-wrap"><table class="line-table"><thead><tr><th style="width:28%">Rate source</th><th style="width:29%">Description</th><th style="width:8%">Unit</th><th style="width:8%">Qty</th><th style="width:13%">Unit price</th><th style="width:12%;text-align:right">Total</th><th></th></tr></thead><tbody>
            ${doc.lines.map((line, index) => lineRow(line, index, locked)).join('')}
          </tbody></table></div>
          ${!locked ? `<div class="line-actions"><button class="button button-secondary button-sm" data-action="add-catalog-line">${icons.plus} Price book line</button><button class="button button-ghost button-sm" data-action="add-custom-line">${icons.plus} Custom line</button></div>` : ''}
          <div class="totals-box"><div class="total-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="total-row"><span>VAT (${Number(doc.vat_rate || 0).toFixed(1)}%)</span><strong>${money(vat)}</strong></div><div class="total-row grand"><span>Total payable</span><strong>${money(total)}</strong></div></div>
        </section>
        <section class="section"><div class="section-title"><div><h2>Terms & notes</h2><p>Shown on the final document</p></div></div><div class="form-grid">
          ${field('VAT rate (%)', 'vat_rate', doc.vat_rate, 'number', locked)}
          <div></div>
          <div class="field full"><label>Terms and conditions</label><textarea data-doc-field="terms" ${locked ? 'disabled' : ''}>${escapeHtml(doc.terms)}</textarea></div>
          <div class="field full"><label>Internal / document notes</label><textarea data-doc-field="notes" ${locked ? 'disabled' : ''}>${escapeHtml(doc.notes)}</textarea></div>
        </div></section>
      </div>
      <aside class="editor-aside">
        <div class="card"><div class="price-check"><span class="price-check-icon">${icons.shield}</span><div><h3>Finalisation check</h3><p>Linked lines must match the official PDF price book. Custom lines need a commercial reason.</p></div></div>
          ${locked ? `<button class="button button-primary" data-action="preview">${icons.print} Print / save PDF</button>${doc.type === 'quote' ? `<button class="button button-secondary" data-action="convert">${icons.copy} Convert to invoice</button>` : ''}` : `<button class="button button-primary" data-action="finalise">${icons.shield} Verify & finalise</button><button class="button button-ghost" data-action="save">Save draft</button>`}
        </div>
        <div class="card"><span class="eyebrow">Document total</span><h3 style="margin-top:8px;font-size:24px">${money(total)}</h3><p>${doc.lines.length} line item${doc.lines.length === 1 ? '' : 's'} · VAT ${Number(doc.vat_rate || 0).toFixed(1)}%</p></div>
      </aside>
    </div>`;
  bindEditorEvents();
}

function field(label, name, value, type = 'text', disabled = false) {
  const attrs = type === 'number' ? 'step="0.1" min="0"' : '';
  return `<div class="field"><label>${escapeHtml(label)}</label><input type="${type}" data-doc-field="${name}" value="${escapeHtml(value ?? '')}" ${attrs} ${disabled ? 'disabled' : ''}></div>`;
}

function customerSummary(id) {
  const c = state.customers.find(item => Number(item.id) === Number(id));
  if (!c) return '';
  const contact = [c.attention, c.telephone, c.email].filter(Boolean).join(' · ');
  return `<div class="source-note" style="margin:12px 0 0">${icons.users}<span><strong>${escapeHtml([c.address1, c.address2].filter(Boolean).join(', ') || 'No address recorded')}</strong><br>${escapeHtml(contact || 'No contact details recorded')}</span></div>`;
}

function lineRow(line, index, locked) {
  const isControlled = Boolean(line.catalog_item_id);
  const total = Math.round(Number(line.quantity || 0) * Number(line.unit_price_cents || 0));
  return `<tr data-line-row="${index}">
    <td><select data-line="${index}" data-line-field="catalog_item_id" ${locked ? 'disabled' : ''}><option value="">Custom rate</option>${state.catalog.map(item => `<option value="${item.id}" ${Number(line.catalog_item_id) === Number(item.id) ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select><span class="line-source ${isControlled ? 'controlled' : ''}">${isControlled ? '✓ Controlled by 2026 price book' : 'Custom · reason required'}</span></td>
    <td><input data-line="${index}" data-line-field="description" value="${escapeHtml(line.description)}" placeholder="Service or equipment" ${locked ? 'disabled' : ''}>${!isControlled && !locked ? `<input style="margin-top:5px" data-line="${index}" data-line-field="custom_reason" value="${escapeHtml(line.custom_reason || '')}" placeholder="Reason for custom rate…">` : ''}</td>
    <td><input data-line="${index}" data-line-field="unit" value="${escapeHtml(line.unit)}" ${locked ? 'disabled' : ''}></td>
    <td><input type="number" min="0.01" step="0.01" data-line="${index}" data-line-field="quantity" value="${line.quantity}" ${locked ? 'disabled' : ''}></td>
    <td><input type="number" min="0" step="0.01" data-line="${index}" data-line-field="unit_price" value="${(Number(line.unit_price_cents) / 100).toFixed(2)}" ${locked ? 'disabled' : ''}></td>
    <td class="line-total">${money(total)}</td>
    <td>${!locked ? `<button class="icon-button line-remove" data-action="remove-line" data-index="${index}" aria-label="Remove line">${icons.trash}</button>` : ''}</td>
  </tr>`;
}

function validationHtml(validation) {
  if (!validation) return '';
  const mismatch = validation.mismatches || [];
  const custom = validation.unjustified || [];
  return `<div class="validation-panel"><strong>Price verification needs attention</strong><span>Correct the following before finalising:</span><ul>${mismatch.map(item => `<li>${escapeHtml(item.description)} is ${money(item.entered_cents)}; price book rate is ${money(item.expected_cents)}.</li>`).join('')}${custom.map(item => `<li>${escapeHtml(item.description)} needs a reason for its custom rate.</li>`).join('')}</ul></div>`;
}

function bindEditorEvents() {
  app.querySelectorAll('[data-doc-field]').forEach(input => input.addEventListener('input', event => {
    const key = event.target.dataset.docField;
    state.editor[key] = key === 'customer_id' || key === 'vat_rate' ? Number(event.target.value) : event.target.value;
    if (key === 'customer_id') renderEditor();
    if (key === 'vat_rate') renderEditorPreservingFocus(key);
  }));
  app.querySelectorAll('[data-line-field]').forEach(input => input.addEventListener('change', event => {
    const index = Number(event.target.dataset.line);
    const key = event.target.dataset.lineField;
    if (key === 'catalog_item_id') {
      const selected = state.catalog.find(item => Number(item.id) === Number(event.target.value));
      if (selected) state.editor.lines[index] = { ...catalogLine(selected), quantity: state.editor.lines[index].quantity || 1 };
      else state.editor.lines[index] = { ...state.editor.lines[index], catalog_item_id: null, code: '', custom_reason: '' };
      renderEditor();
      return;
    }
    state.editor.lines[index][key === 'unit_price' ? 'unit_price_cents' : key] = key === 'unit_price' ? Math.round(Number(event.target.value) * 100) : key === 'quantity' ? Number(event.target.value) : event.target.value;
    if (key === 'quantity' || key === 'unit_price') renderEditor();
  }));
}

function renderEditorPreservingFocus(field) {
  renderEditor();
  app.querySelector(`[data-doc-field="${field}"]`)?.focus();
}

async function saveEditor(showToast = true) {
  const doc = state.editor;
  const payload = {
    ...doc,
    lines: doc.lines.map(line => ({ ...line, unit_price_cents: Math.round(Number(line.unit_price_cents)) }))
  };
  const saved = doc.id
    ? await api(`/api/documents/${doc.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await api('/api/documents', { method: 'POST', body: JSON.stringify(payload) });
  state.editor = saved;
  state.validation = null;
  if (showToast) toast('Draft saved');
  renderEditor();
  return saved;
}

async function finaliseEditor() {
  try {
    const saved = await saveEditor(false);
    state.editor = await api(`/api/documents/${saved.id}/finalise`, { method: 'POST' });
    state.validation = null;
    toast(`${state.editor.type === 'quote' ? 'Quotation' : 'Invoice'} verified and finalised`);
    renderEditor();
  } catch (error) {
    if (error.details) {
      state.validation = error.details;
      renderEditor();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else toast(error.message, 'error');
  }
}

async function renderPreview(id) {
  const doc = state.editor?.id === Number(id) ? state.editor : await api(`/api/documents/${id}`);
  setActiveNav(doc.type === 'invoice' ? 'invoices' : 'quotes');
  const print = printableDocument(doc);
  printLayer.innerHTML = print;
  app.innerHTML = `${pageHead('Document preview', doc.number, 'A4 preview based on the supplied AAXAL quotations and invoices.', `<a class="button button-ghost" href="#/document/${doc.id}">Back to document</a><button class="button button-primary" data-action="print">${icons.print} Print / save PDF</button>`)}<div class="preview-wrap">${print}</div>`;
}

function printableDocument(doc) {
  const s = state.settings;
  const isInvoice = doc.type === 'invoice';
  const subtotal = doc.lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unit_price_cents), 0);
  const vat = Math.round(subtotal * Number(doc.vat_rate) / 100);
  const total = subtotal + vat;
  return `<article class="print-document">
    <header class="print-head"><div class="print-title">${isInvoice ? 'Invoice' : 'Quote'}</div><div><div class="print-logo"><strong>AAXAL</strong><small>OFFSHORE SERVICES</small></div><div class="print-company"><strong>${escapeHtml(s.company_name)}</strong><br>${escapeHtml(s.address)}<br>Tel: ${escapeHtml(s.telephone)}<br>E-mail: ${escapeHtml(s.email)}<br>Web: ${escapeHtml(s.website)}</div></div></header>
    <table class="print-meta"><tbody>
      <tr><th>Date:</th><td>${formatDate(doc.issue_date)}</td></tr>
      <tr><th>Order Ref:</th><td>${escapeHtml(doc.order_ref || '—')}</td></tr>
      <tr><th>${isInvoice ? 'Invoice No.:' : 'Quote Number:'}</th><td>${escapeHtml(doc.number)}</td></tr>
      ${isInvoice && doc.quotation_ref ? `<tr><th>Quote Ref:</th><td>${escapeHtml(doc.quotation_ref)}</td></tr>` : ''}
      <tr><th>${isInvoice ? 'To:' : 'Company:'}</th><td>${escapeHtml(doc.company_name)}</td></tr>
      <tr><th>Address:</th><td>${escapeHtml([doc.address1, doc.address2].filter(Boolean).join(', '))}</td></tr>
      <tr><th>Attention:</th><td>${escapeHtml(doc.attention || '—')}</td></tr>
    </tbody></table>
    <table class="print-lines"><caption>${isInvoice ? 'Invoice' : 'Quotation'}</caption><thead><tr><th>S. No.</th><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Line total</th></tr></thead><tbody>
      ${doc.lines.map((line, index) => `<tr><td>${escapeHtml(line.code || `L${index + 1}`)}</td><td>${escapeHtml(line.description)}</td><td>${escapeHtml(line.unit)}</td><td class="num">${Number(line.quantity).toLocaleString('en-US')}</td><td class="num">${money(line.unit_price_cents)}</td><td class="num">${money(Math.round(line.quantity * line.unit_price_cents))}</td></tr>`).join('')}
      <tr class="sum-row"><td colspan="5">Subtotal</td><td class="num">${money(subtotal)}</td></tr>
      <tr class="sum-row"><td colspan="5">Value Added Tax (VAT) at ${Number(doc.vat_rate).toFixed(1)}%</td><td class="num">${money(vat)}</td></tr>
      <tr class="sum-row grand-row"><td colspan="5">${isInvoice ? 'Total Invoice Amount Payable' : 'Total Quotation Amount'}</td><td class="num">${money(total)}</td></tr>
    </tbody></table>
    ${isInvoice ? `<p class="payment-note">${escapeHtml(doc.terms || invoiceTerms)}</p>${bankTable(s, total)}` : `<div class="print-terms"><strong>The above quotation is submitted on the following terms and conditions:</strong><br>${escapeHtml(doc.terms)}</div>`}
    <footer class="print-signoff"><div>Sincerely yours,<div class="signature-line"></div><strong>${escapeHtml(s.signatory_name)}</strong><br>On behalf of ${escapeHtml(s.short_name)}</div><div class="tin-box">AAXAL Offshore Services Ltd<br>Tax Identification Number (TIN) - ${escapeHtml(s.tin)}</div></footer>
  </article>`;
}

function bankTable(settings, total) {
  return `<table class="bank-table"><caption>USD Bank Details</caption><tbody><tr class="payable"><th>Amount payable:</th><td>${money(total)}</td></tr><tr><th>Bank:</th><td>${escapeHtml(settings.bank_name)}</td></tr><tr><th>Address:</th><td>${escapeHtml(settings.bank_address)}</td></tr><tr><th>Account name:</th><td>${escapeHtml(settings.account_name)}</td></tr><tr><th>Account no.:</th><td>${escapeHtml(settings.account_number)}</td></tr></tbody></table>`;
}

function openCustomerModal(customer = null) {
  const c = customer || { company_name: '', telephone: '', email: '', address1: '', address2: '', attention: '' };
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><form class="modal" id="customerForm"><div class="modal-head"><div><h2>${customer ? 'Edit' : 'Add'} customer</h2><p>Telephone numbers are normalised for fast searching.</p></div><button type="button" class="icon-button" data-action="close-modal">${icons.close}</button></div><div class="modal-body"><div class="form-grid">
    <div class="field full"><label>Company name <span class="required">*</span></label><input name="company_name" value="${escapeHtml(c.company_name)}" required autofocus></div>
    <div class="field"><label>Telephone</label><input name="telephone" type="tel" value="${escapeHtml(c.telephone)}"></div>
    <div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(c.email)}"></div>
    <div class="field"><label>Address line 1</label><input name="address1" value="${escapeHtml(c.address1)}"></div>
    <div class="field"><label>Address line 2</label><input name="address2" value="${escapeHtml(c.address2)}"></div>
    <div class="field full"><label>Attention / contact person</label><input name="attention" value="${escapeHtml(c.attention)}"></div>
  </div></div><div class="modal-foot"><button type="button" class="button button-ghost" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">Save customer</button></div></form></div>`;
  document.querySelector('#customerForm').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    try {
      const saved = await api(customer ? `/api/customers/${customer.id}` : '/api/customers', { method: customer ? 'PUT' : 'POST', body: JSON.stringify(values) });
      const bootstrap = await api('/api/bootstrap');
      state.customers = bootstrap.customers;
      modalRoot.innerHTML = '';
      toast(`Customer ${customer ? 'updated' : 'added'}`);
      if (state.editor) { state.editor.customer_id = saved.id; renderEditor(); }
      else route();
    } catch (error) { toast(error.message, 'error'); }
  });
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

async function route() {
  document.querySelector('#sidebar').classList.remove('open');
  const raw = location.hash.slice(1) || '/overview';
  const [pathname, queryString = ''] = raw.split('?');
  const params = new URLSearchParams(queryString);
  const parts = pathname.split('/').filter(Boolean);
  app.innerHTML = '<div class="loading-state"><span class="spinner"></span>Loading…</div>';
  try {
    if (pathname === '/overview') return renderOverview();
    if (pathname === '/quotes') return renderDocuments('quote');
    if (pathname === '/invoices') return renderDocuments('invoice');
    if (pathname === '/customers') return renderCustomers();
    if (pathname === '/catalog') return renderCatalog();
    if (pathname === '/document/new') return newDocument(params.get('type') === 'invoice' ? 'invoice' : 'quote');
    if (parts[0] === 'document' && parts[1] && parts[2] === 'preview') return renderPreview(Number(parts[1]));
    if (parts[0] === 'document' && parts[1]) return loadDocument(Number(parts[1]));
    location.hash = '#/overview';
  } catch (error) {
    app.innerHTML = `<div class="empty-state"><div class="empty-icon">${icons.info}</div><h3>Unable to load this page</h3><p>${escapeHtml(error.message)}</p><a class="button button-primary" href="#/overview">Return to overview</a></div>`;
  }
}

document.addEventListener('click', async event => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === 'new-customer') openCustomerModal();
  if (action === 'close-modal') {
    if (event.target === actionEl || actionEl.closest('button')) modalRoot.innerHTML = '';
  }
  if (action === 'edit-customer') {
    const customer = state.customers.find(item => Number(item.id) === Number(actionEl.dataset.id));
    openCustomerModal(customer);
  }
  if (action === 'add-catalog-line') { state.editor.lines.push(catalogLine(state.catalog[0])); renderEditor(); }
  if (action === 'add-custom-line') { state.editor.lines.push({ catalog_item_id: null, code: '', description: '', unit: 'LS', quantity: 1, unit_price_cents: 0, custom_reason: '' }); renderEditor(); }
  if (action === 'remove-line') { state.editor.lines.splice(Number(actionEl.dataset.index), 1); renderEditor(); }
  if (action === 'save') {
    try { await saveEditor(); } catch (error) { toast(error.message, 'error'); }
  }
  if (action === 'finalise') await finaliseEditor();
  if (action === 'preview' && state.editor?.id) location.hash = `#/document/${state.editor.id}/preview`;
  if (action === 'print') window.print();
  if (action === 'convert') {
    const source = state.editor;
    await newDocument('invoice', source);
    history.replaceState(null, '', '#/document/new?type=invoice');
  }
});

document.querySelector('#menuButton').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
window.addEventListener('hashchange', route);

(async function init() {
  try {
    const bootstrap = await api('/api/bootstrap');
    state.settings = bootstrap.settings;
    state.customers = bootstrap.customers;
    state.catalog = bootstrap.catalog;
    await route();
  } catch (error) {
    app.innerHTML = `<div class="empty-state"><h3>Unable to start AAXAL Office</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
})();
