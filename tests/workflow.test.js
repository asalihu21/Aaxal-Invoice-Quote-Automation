const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const testDb = path.join('/tmp', `aaxal-office-test-${process.pid}.sqlite`);
process.env.AAXAL_DB_PATH = testDb;

const { db, now, normalisePhone } = require('../db');
const { getDocument, finaliseDocument, createDocument, updateDocument, customerRows } = require('../server');

test('AAXAL document workflow', async t => {
  await t.test('seeds the supplied 2026 price list', async () => {
    const catalog = db.prepare('SELECT * FROM catalog_items ORDER BY id').all();
    const settings = db.prepare('SELECT * FROM company_settings WHERE id=1').get();
    assert.equal(catalog.length, 10);
    assert.equal(catalog[0].rate_cents, 31500);
    assert.equal(catalog[8].rate_cents, 25000);
    assert.equal(settings.tin, '17645951-0001');
  });

  await t.test('finds customers by company name and normalised telephone', async () => {
    const stamp = now();
    db.prepare(`INSERT INTO customers
      (company_name, telephone, phone_search, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`)
      .run('Atlantic Test Services', '+234 (803) 555-0199', normalisePhone('+234 (803) 555-0199'), stamp, stamp);
    assert.equal(customerRows('atlantic')[0].company_name, 'Atlantic Test Services');
    assert.equal(customerRows('803555')[0].company_name, 'Atlantic Test Services');
  });

  await t.test('blocks invalid prices and unjustified custom rates before finalisation', async () => {
    const controlled = db.prepare('SELECT * FROM catalog_items ORDER BY id LIMIT 1').get();
    const customer = db.prepare('SELECT * FROM customers ORDER BY id LIMIT 1').get();
    const payload = {
      type: 'quote',
      number: 'AOS/Q/TEST/0001',
      customer_id: customer.id,
      issue_date: '2026-09-03',
      vat_rate: 7.5,
      terms: 'Test terms',
      lines: [
        { catalog_item_id: controlled.id, code: controlled.code, description: controlled.name, unit: 'day', quantity: 2, unit_price_cents: controlled.rate_cents },
        { description: 'Equipment mobilisation', unit: 'LS', quantity: 1, unit_price_cents: 12500, custom_reason: '' }
      ]
    };
    const created = createDocument(payload);
    assert.equal(getDocument(created.id).number, payload.number);

    assert.throws(() => finaliseDocument(created.id), error => {
      assert.equal(error.status, 409);
      assert.equal(error.details.unjustified.length, 1);
      return true;
    });

    payload.lines[1].custom_reason = 'Approved project-specific mobilisation rate';
    payload.lines[0].unit_price_cents = 30000;
    updateDocument(created.id, payload);
    assert.throws(() => finaliseDocument(created.id), error => {
      assert.equal(error.status, 409);
      assert.equal(error.details.mismatches[0].expected_cents, 31500);
      return true;
    });

    payload.lines[0].unit_price_cents = 31500;
    updateDocument(created.id, payload);
    const finalised = finaliseDocument(created.id);
    assert.equal(finalised.status, 'finalised');
    assert.ok(finalised.price_checked_at);
    assert.throws(() => updateDocument(created.id, payload), error => error.status === 409);
  });

  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(`${testDb}${suffix}`); } catch {}
  }
});
