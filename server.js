const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { db, now, normalisePhone, transaction } = require('./db');

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, 'public');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) reject(new Error('Request is too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function customerRows(search = '') {
  const text = search.trim();
  const phone = normalisePhone(text);
  if (!text) {
    return db.prepare(`SELECT c.*, COUNT(d.id) AS document_count
      FROM customers c LEFT JOIN documents d ON d.customer_id = c.id
      GROUP BY c.id ORDER BY c.company_name COLLATE NOCASE`).all();
  }
  return db.prepare(`SELECT c.*, COUNT(d.id) AS document_count
    FROM customers c LEFT JOIN documents d ON d.customer_id = c.id
    WHERE lower(c.company_name) LIKE lower(?) OR c.phone_search LIKE ?
    GROUP BY c.id ORDER BY c.company_name COLLATE NOCASE`)
    .all(`%${text}%`, `%${phone}%`);
}

function getDocument(id) {
  const document = db.prepare(`SELECT d.*, c.company_name, c.telephone, c.email AS customer_email,
      c.address1, c.address2, c.attention
    FROM documents d JOIN customers c ON c.id = d.customer_id WHERE d.id = ?`).get(id);
  if (!document) return null;
  document.lines = db.prepare(`SELECT l.*, ci.name AS catalog_name, ci.rate_cents AS current_rate_cents
    FROM line_items l LEFT JOIN catalog_items ci ON ci.id = l.catalog_item_id
    WHERE l.document_id = ? ORDER BY l.sort_order, l.id`).all(id);
  document.subtotal_cents = document.lines.reduce((sum, line) => sum + Math.round(line.quantity * line.unit_price_cents), 0);
  document.vat_cents = Math.round(document.subtotal_cents * Number(document.vat_rate) / 100);
  document.total_cents = document.subtotal_cents + document.vat_cents;
  return document;
}

function listDocuments(url) {
  const where = [];
  const params = [];
  if (url.searchParams.get('type')) { where.push('d.type = ?'); params.push(url.searchParams.get('type')); }
  if (url.searchParams.get('status')) { where.push('d.status = ?'); params.push(url.searchParams.get('status')); }
  if (url.searchParams.get('q')) {
    where.push('(lower(d.number) LIKE lower(?) OR lower(c.company_name) LIKE lower(?) OR lower(d.order_ref) LIKE lower(?))');
    const q = `%${url.searchParams.get('q')}%`;
    params.push(q, q, q);
  }
  return db.prepare(`SELECT d.*, c.company_name,
      COALESCE(SUM(ROUND(l.quantity * l.unit_price_cents)), 0) AS subtotal_cents
    FROM documents d JOIN customers c ON c.id = d.customer_id
    LEFT JOIN line_items l ON l.document_id = d.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY d.id ORDER BY d.issue_date DESC, d.id DESC`).all(...params).map(row => ({
      ...row,
      total_cents: row.subtotal_cents + Math.round(row.subtotal_cents * Number(row.vat_rate) / 100)
    }));
}

function nextNumber(type) {
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) AS count FROM documents WHERE type = ?').get(type).count + 1;
  return `AOS/${type === 'quote' ? 'Q' : 'INV'}/${year}/${String(count).padStart(4, '0')}`;
}

function validateDocumentInput(body) {
  if (!['quote', 'invoice'].includes(body.type)) throw new Error('Document type must be quote or invoice');
  if (!body.customer_id) throw new Error('Please select a customer');
  if (!String(body.number || '').trim()) throw new Error('Document number is required');
  if (!body.issue_date) throw new Error('Issue date is required');
  if (!Array.isArray(body.lines)) throw new Error('Line items are required');
}

function saveLines(documentId, lines) {
  db.prepare('DELETE FROM line_items WHERE document_id = ?').run(documentId);
  const add = db.prepare(`INSERT INTO line_items
    (document_id, catalog_item_id, code, description, unit, quantity, unit_price_cents, custom_reason, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  lines.forEach((line, index) => {
    const description = String(line.description || '').trim();
    const quantity = Number(line.quantity);
    const price = Number(line.unit_price_cents);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(price) || price < 0) {
      throw new Error(`Line ${index + 1} is incomplete`);
    }
    add.run(documentId, line.catalog_item_id || null, line.code || '', description, line.unit || 'day', quantity, price, line.custom_reason || '', index);
  });
}

function createDocument(body) {
  validateDocumentInput(body);
  return transaction(() => {
    const stamp = now();
    const result = db.prepare(`INSERT INTO documents
      (type, number, customer_id, issue_date, valid_until, due_date, order_ref, quotation_ref, po_date, currency, vat_rate, terms, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?)`)
      .run(body.type, body.number.trim(), body.customer_id, body.issue_date, body.valid_until || '', body.due_date || '', body.order_ref || '', body.quotation_ref || '', body.po_date || '', Number(body.vat_rate ?? 7.5), body.terms || '', body.notes || '', stamp, stamp);
    saveLines(Number(result.lastInsertRowid), body.lines);
    return getDocument(Number(result.lastInsertRowid));
  });
}

function updateDocument(id, body) {
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!existing) return null;
  if (existing.status === 'finalised') throw Object.assign(new Error('Finalised documents are locked'), { status: 409 });
  validateDocumentInput(body);
  return transaction(() => {
    db.prepare(`UPDATE documents SET type=?, number=?, customer_id=?, issue_date=?, valid_until=?, due_date=?,
      order_ref=?, quotation_ref=?, po_date=?, vat_rate=?, terms=?, notes=?, updated_at=? WHERE id=?`)
      .run(body.type, body.number.trim(), body.customer_id, body.issue_date, body.valid_until || '', body.due_date || '', body.order_ref || '', body.quotation_ref || '', body.po_date || '', Number(body.vat_rate ?? 7.5), body.terms || '', body.notes || '', now(), id);
    saveLines(id, body.lines);
    return getDocument(id);
  });
}

function finaliseDocument(id) {
  const document = getDocument(id);
  if (!document) return null;
  if (!document.lines.length) throw Object.assign(new Error('Add at least one line item before finalising'), { status: 409 });
  const mismatches = document.lines.filter(line => line.catalog_item_id && line.unit_price_cents !== line.current_rate_cents)
    .map(line => ({ id: line.id, description: line.description, entered_cents: line.unit_price_cents, expected_cents: line.current_rate_cents }));
  const unjustified = document.lines.filter(line => !line.catalog_item_id && !line.custom_reason.trim())
    .map(line => ({ id: line.id, description: line.description }));
  if (mismatches.length || unjustified.length) {
    throw Object.assign(new Error('Price verification needs attention'), { status: 409, details: { mismatches, unjustified } });
  }
  const stamp = now();
  db.prepare(`UPDATE documents SET status='finalised', finalised_at=?, price_checked_at=?, updated_at=? WHERE id=?`)
    .run(stamp, stamp, stamp, id);
  return getDocument(id);
}

async function handleApi(req, res, url) {
  const method = req.method;
  const parts = url.pathname.split('/').filter(Boolean);

  if (method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true });
  if (method === 'GET' && url.pathname === '/api/bootstrap') {
    return json(res, 200, {
      settings: db.prepare('SELECT * FROM company_settings WHERE id = 1').get(),
      customers: customerRows(),
      catalog: db.prepare('SELECT * FROM catalog_items WHERE active = 1 ORDER BY id').all()
    });
  }
  if (method === 'GET' && url.pathname === '/api/dashboard') {
    const stats = db.prepare(`SELECT
      COUNT(CASE WHEN type='quote' THEN 1 END) AS quotes,
      COUNT(CASE WHEN type='invoice' THEN 1 END) AS invoices,
      COUNT(CASE WHEN status='draft' THEN 1 END) AS drafts
      FROM documents`).get();
    stats.customers = db.prepare('SELECT COUNT(*) AS count FROM customers').get().count;
    return json(res, 200, { stats, recent: listDocuments(new URL('/api/documents', 'http://local')).slice(0, 6) });
  }
  if (method === 'GET' && url.pathname === '/api/customers') return json(res, 200, customerRows(url.searchParams.get('q') || ''));
  if (method === 'POST' && url.pathname === '/api/customers') {
    const body = await readBody(req);
    if (!String(body.company_name || '').trim()) return json(res, 400, { error: 'Company name is required' });
    const stamp = now();
    const result = db.prepare(`INSERT INTO customers
      (company_name, telephone, phone_search, email, address1, address2, attention, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(body.company_name.trim(), body.telephone || '', normalisePhone(body.telephone), body.email || '', body.address1 || '', body.address2 || '', body.attention || '', stamp, stamp);
    return json(res, 201, db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(result.lastInsertRowid)));
  }
  if (method === 'PUT' && parts[1] === 'customers' && parts[2]) {
    const body = await readBody(req);
    if (!String(body.company_name || '').trim()) return json(res, 400, { error: 'Company name is required' });
    db.prepare(`UPDATE customers SET company_name=?, telephone=?, phone_search=?, email=?, address1=?, address2=?, attention=?, updated_at=? WHERE id=?`)
      .run(body.company_name.trim(), body.telephone || '', normalisePhone(body.telephone), body.email || '', body.address1 || '', body.address2 || '', body.attention || '', now(), Number(parts[2]));
    return json(res, 200, db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(parts[2])));
  }
  if (method === 'GET' && url.pathname === '/api/catalog') {
    const q = `%${url.searchParams.get('q') || ''}%`;
    return json(res, 200, db.prepare(`SELECT * FROM catalog_items WHERE active=1 AND (name LIKE ? OR code LIKE ?) ORDER BY id`).all(q, q));
  }
  if (method === 'GET' && url.pathname === '/api/documents') return json(res, 200, listDocuments(url));
  if (method === 'GET' && url.pathname === '/api/documents/next-number') {
    return json(res, 200, { number: nextNumber(url.searchParams.get('type') === 'invoice' ? 'invoice' : 'quote') });
  }
  if (method === 'GET' && parts[1] === 'documents' && parts[2]) {
    const document = getDocument(Number(parts[2]));
    return document ? json(res, 200, document) : json(res, 404, { error: 'Document not found' });
  }
  if (method === 'POST' && url.pathname === '/api/documents') return json(res, 201, createDocument(await readBody(req)));
  if (method === 'PUT' && parts[1] === 'documents' && parts[2]) {
    const document = updateDocument(Number(parts[2]), await readBody(req));
    return document ? json(res, 200, document) : json(res, 404, { error: 'Document not found' });
  }
  if (method === 'POST' && parts[1] === 'documents' && parts[2] && parts[3] === 'finalise') {
    const document = finaliseDocument(Number(parts[2]));
    return document ? json(res, 200, document) : json(res, 404, { error: 'Document not found' });
  }
  return json(res, 404, { error: 'Not found' });
}

function serveStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.normalize(path.join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Forbidden' });
  fs.readFile(filePath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (fallbackError, fallback) => {
        if (fallbackError) return json(res, 404, { error: 'Not found' });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(fallback);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(res, url.pathname);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return json(res, 409, { error: 'That document number is already in use' });
    json(res, error.status || 400, { error: error.message || 'Something went wrong', details: error.details });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`AAXAL Office running at http://localhost:${PORT}`));
}

module.exports = { server, getDocument, finaliseDocument, createDocument, updateDocument, customerRows };
