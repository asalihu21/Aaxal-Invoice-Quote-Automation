const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.AAXAL_DB_PATH || path.join(DATA_DIR, 'aaxal.sqlite');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

function now() {
  return new Date().toISOString();
}

function normalisePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      company_name TEXT NOT NULL,
      short_name TEXT NOT NULL,
      address TEXT NOT NULL,
      telephone TEXT NOT NULL,
      email TEXT NOT NULL,
      website TEXT NOT NULL,
      tin TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      bank_address TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      signatory_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      telephone TEXT NOT NULL DEFAULT '',
      phone_search TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address1 TEXT NOT NULL DEFAULT '',
      address2 TEXT NOT NULL DEFAULT '',
      attention TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      rate_cents INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('quote', 'invoice')),
      number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'finalised')),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      issue_date TEXT NOT NULL,
      valid_until TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      order_ref TEXT NOT NULL DEFAULT '',
      quotation_ref TEXT NOT NULL DEFAULT '',
      po_date TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'USD',
      vat_rate REAL NOT NULL DEFAULT 7.5,
      terms TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      finalised_at TEXT,
      price_checked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      catalog_item_id INTEGER REFERENCES catalog_items(id),
      code TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'day',
      quantity REAL NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      custom_reason TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(company_name);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_search);
    CREATE INDEX IF NOT EXISTS idx_documents_customer ON documents(customer_id);
    CREATE INDEX IF NOT EXISTS idx_documents_type_status ON documents(type, status);
  `);
}

function seed() {
  const stamp = now();
  db.prepare(`INSERT OR IGNORE INTO company_settings
    (id, company_name, short_name, address, telephone, email, website, tin, bank_name, bank_address, account_name, account_number, signatory_name)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      'AAXAL Offshore Services Limited',
      'AAXAL Offshore',
      '7 Kebbi Street, Osborne Foreshore Estate, Ikoyi-Lagos, Nigeria',
      '+234-90-95235688',
      'info@aaxal.com',
      'www.aaxal.com',
      '17645951-0001',
      'GT Bank',
      'Plot 1072 J.S. Tarka/Faskari St., Area 3, Garki-Abuja',
      'Aaxal Offshore Services Ltd',
      '0111460758',
      'Safiyyah Gwandu (Mrs)'
    );

  const customerCount = db.prepare('SELECT COUNT(*) AS count FROM customers').get().count;
  if (!customerCount) {
    const add = db.prepare(`INSERT INTO customers
      (company_name, telephone, phone_search, email, address1, address2, attention, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    add.run('Hydrodive (Nig) Limited', '', '', '', '17 Wharf Road, Apapa', 'Lagos, Nigeria', 'A. Ejidike', stamp, stamp);
    add.run('UIML', '', '', '', 'LakePoint 9B Fourth Avenue Drive, Ogbatai, Woji', 'Port Harcourt, Nigeria', 'T. Minima', stamp, stamp);
  }

  const catalogue = [
    ['ACFM-CSWIP-L2-ON', 'CSWIP L2 ACFM Operator — Onshore', 31500],
    ['ACFM-CSWIP-L2-OFF', 'CSWIP L2 ACFM Operator — Offshore', 31500],
    ['ACFM-CSWIP-L1-ON', 'CSWIP L1 ACFM Operator — Onshore', 31500],
    ['ACFM-CSWIP-L1-OFF', 'CSWIP L1 ACFM Operator — Offshore', 31500],
    ['ACFM-ASNT-L2-ON', 'ASNT L2 ACFM Operator — Onshore', 31500],
    ['ACFM-ASNT-L2-OFF', 'ASNT L2 ACFM Operator — Offshore', 31500],
    ['ACFM-ASNT-L1-ON', 'ASNT L1 ACFM Operator — Onshore', 31500],
    ['ACFM-ASNT-L1-OFF', 'ASNT L1 ACFM Operator — Offshore', 31500],
    ['NDT-ASST-ON', 'NDT Inspection Assistant — Onshore', 25000],
    ['NDT-ASST-OFF', 'NDT Inspection Assistant — Offshore', 25000]
  ];
  const addItem = db.prepare(`INSERT OR IGNORE INTO catalog_items
    (code, name, category, unit, currency, rate_cents, source, created_at, updated_at)
    VALUES (?, ?, 'Operator & Personnel Rates', 'day', 'USD', ?, 'AAXAL OS Price List 2026.pdf', ?, ?)`);
  for (const item of catalogue) addItem.run(item[0], item[1], item[2], stamp, stamp);

  const documentCount = db.prepare('SELECT COUNT(*) AS count FROM documents').get().count;
  if (!documentCount) seedSourceDocuments(stamp);
}

function seedSourceDocuments(stamp) {
  const hydrodive = db.prepare("SELECT id FROM customers WHERE company_name LIKE 'Hydrodive%' LIMIT 1").get();
  const uiml = db.prepare("SELECT id FROM customers WHERE company_name = 'UIML' LIMIT 1").get();
  const operator = db.prepare("SELECT id FROM catalog_items WHERE code = 'ACFM-CSWIP-L2-OFF'").get();
  const addDocument = db.prepare(`INSERT INTO documents
    (type, number, status, customer_id, issue_date, valid_until, due_date, order_ref, quotation_ref,
     po_date, currency, vat_rate, terms, notes, finalised_at, price_checked_at, created_at, updated_at)
    VALUES (?, ?, 'finalised', ?, ?, ?, ?, ?, ?, ?, 'USD', 7.5, ?, ?, ?, ?, ?, ?)`);
  const addLine = db.prepare(`INSERT INTO line_items
    (document_id, catalog_item_id, code, description, unit, quantity, unit_price_cents, custom_reason, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const quoteTerms = '1. NDT Level III services are excluded and, if required, will be invoiced separately.\n2. This quotation is valid for one calendar month.\n3. Personnel and equipment are invoiced door-to-door from mobilisation to demobilisation.\n4. Additional hours are invoiced pro-rata.\n5. All amounts are stated in United States Dollars.';
  const invoiceTerms = 'Please arrange payment into the AAXAL Offshore Services Limited account using the bank details shown below and include the invoice number as the payment reference.';

  const add = (doc, lines) => {
    const result = addDocument.run(doc.type, doc.number, doc.customer, doc.issue, doc.valid || '', doc.due || '', doc.order || '', doc.quote || '', doc.poDate || '', doc.terms, doc.notes || 'Imported from the supplied source PDF.', stamp, stamp, stamp, stamp);
    const id = Number(result.lastInsertRowid);
    lines.forEach((line, index) => addLine.run(id, line.catalog || null, line.code, line.description, line.unit, line.qty, line.price, line.reason || '', index));
  };

  add({ type: 'quote', number: 'AOS/0069/0970/Rev01', customer: hydrodive.id, issue: '2026-06-17', valid: '2026-07-17', order: 'Hydrodive/260615/0', terms: quoteTerms }, [
    { catalog: operator.id, code: 'P1', description: '1 × ACFM Operator Level 2 / Day', unit: 'day', qty: 1, price: 31500 },
    { code: 'E1', description: 'Standard Air Diving (0–50m) ACFM Unit / Day', unit: 'day', qty: 1, price: 25000, reason: 'Approved equipment rate from source quotation' },
    { code: 'M1', description: 'Mobilisation, Procedures & Equipment Preparation', unit: 'LS', qty: 1, price: 12500, reason: 'Approved lump-sum rate from source quotation' },
    { code: 'R1', description: 'Final End-of-Project Report (Optional)', unit: 'LS', qty: 1, price: 15700, reason: 'Approved optional rate from source quotation' }
  ]);

  add({ type: 'quote', number: 'AOS/00141/0226/Rev0', customer: uiml.id, issue: '2026-02-06', valid: '2026-03-06', order: 'UIML/260206/02', terms: quoteTerms }, [
    { catalog: operator.id, code: 'P1', description: '1 × ACFM Operator Level 2 / Day', unit: 'day', qty: 20, price: 31500 },
    { code: 'E1', description: 'Standard Saturation Diving (0–150m) ACFM Unit / Day', unit: 'day', qty: 20, price: 25000, reason: 'Approved equipment rate from source quotation' },
    { code: 'E2', description: 'Additional Standard Saturation Diving ACFM Unit / Day', unit: 'day', qty: 20, price: 12500, reason: 'Approved equipment rate from source quotation' }
  ]);

  add({ type: 'invoice', number: 'AOS/0626_0/0000293 Rev0', customer: hydrodive.id, issue: '2026-07-16', due: '2026-08-15', order: 'Hydrodive PO No. 0000000645', quote: 'AOS/0069/0970/Rev01', poDate: '2026-06-30', terms: invoiceTerms }, [
    { catalog: operator.id, code: 'P1', description: 'ACFM Operator Level 2 / Day (01/07/26–16/07/26)', unit: 'day', qty: 16, price: 31500 },
    { code: 'E1', description: 'Standard Air Diving (0–50m) ACFM Unit / Day (01/07/26–16/07/26)', unit: 'day', qty: 16, price: 25000, reason: 'Approved equipment rate from source invoice' }
  ]);

  add({ type: 'invoice', number: 'AOS/0426_1/0001213 Rev00', customer: uiml.id, issue: '2025-04-09', due: '2025-04-09', order: 'UIML-AOS/PO-MOPU2/D0326/01', quote: 'AOS/00141/0126/Rev01', poDate: '2026-03-23', terms: invoiceTerms }, [
    { catalog: operator.id, code: 'P1', description: 'ACFM Operator Level 2 / Day', unit: 'day', qty: 15, price: 31500 },
    { code: 'E1', description: 'Standard Saturation Diving (0–150m) ACFM Unit / Day', unit: 'day', qty: 15, price: 25000, reason: 'Approved equipment rate from source invoice' },
    { code: 'E2', description: 'Additional Standard Saturation Diving ACFM Unit / Day', unit: 'day', qty: 15, price: 12500, reason: 'Approved equipment rate from source invoice' }
  ]);
}

migrate();
seed();

function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { db, DB_PATH, now, normalisePhone, transaction };
