const pool = require('../config/dbPromise');

const ENTITY_TABLE = {
  product: 'products',
  sale: 'sales',
};

// ------------------------------------------------------------------
// Permission map
// ------------------------------------------------------------------
const PERMISSION_MAP = {
  product: { create: '3.3', update: '3.3', delete: '3.3' },
  sale:    { create: '2.3', update: '2.3', delete: '2.3' },
};

function hasPermission(userPerms, code) {
  if (!Array.isArray(userPerms)) return false;
  return userPerms.includes(code);
}

function requiredPermission(entity, op) {
  return PERMISSION_MAP[entity]?.[op] || null;
}

// ------------------------------------------------------------------
// Field whitelists
// ------------------------------------------------------------------
const ALLOWED_FIELDS = {
  product: [
    'prod_name', 'brand', 'prod_manu', 'quantity', 'min_quantity',
    'barcode', 'tax', 'discount', 'manu_date', 'expire_date',
    'cprice', 'sprice', 'mark_up', 'final_price', 'category',
    'description', 'supplier_name', 'meas_type', 'total_amount',
    'payment_method', 'amount_paid', 'profit_amount',
    'unit_per_quantity', 'unit_price', 'profit_per_unit',
  ],
  sale: [
    'product_id', 'prod_name', 'quantity_sold', 'total_amount',
    'amount_paid', 'change_given', 'payment_mode', 'sale_date',
    'user_id', 'username', 'profit', 'serialNumber',
  ],
};

function pickAllowed(entity, data) {
  const allowed = ALLOWED_FIELDS[entity] || [];
  const out = {};
  for (const k of allowed) {
    if (data && data[k] !== undefined) out[k] = data[k];
  }
  return out;
}

// ------------------------------------------------------------------
// Coerce empty strings to NULL for numeric columns
// ------------------------------------------------------------------
const NUMERIC_COLUMNS = {
  product: [
    'quantity', 'min_quantity', 'tax', 'discount', 'cprice', 'sprice',
    'mark_up', 'final_price', 'total_amount', 'amount_paid',
    'profit_amount', 'unit_per_quantity', 'unit_price', 'profit_per_unit',
  ],
  sale: [
    'product_id', 'quantity_sold', 'total_amount', 'amount_paid',
    'change_given', 'user_id', 'profit',
  ],
};

function coerceNumerics(entity, obj) {
  const cols = NUMERIC_COLUMNS[entity] || [];
  const out = { ...obj };
  for (const k of cols) {
    if (out[k] === '' || out[k] === undefined) out[k] = null;
  }
  return out;
}

// ------------------------------------------------------------------
// POST /sync/register-client
// ------------------------------------------------------------------
exports.registerClient = async (req, res) => {
  const { client_id, device_name, device_info } = req.body;
  if (!client_id) return res.status(400).json({ message: 'client_id required' });

  try {
    await pool.query(
      `INSERT INTO sync_clients (client_id, user_id, device_name, device_info, last_seen_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         device_name = VALUES(device_name),
         device_info = VALUES(device_info),
         last_seen_at = NOW()`,
      [client_id, req.user.id, device_name || null, device_info || null]
    );
    res.json({ ok: true, client_id, user_id: req.user.id });
  } catch (error) {
    console.error('Error registering client:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ------------------------------------------------------------------
// POST /sync/push
// ------------------------------------------------------------------
exports.pushChanges = async (req, res) => {
  const { client_id, changes } = req.body;

  if (!client_id || !Array.isArray(changes)) {
    return res.status(400).json({ message: 'client_id and changes[] required' });
  }

  try {
    const [clientRows] = await pool.query(
      'SELECT 1 FROM sync_clients WHERE client_id = ? AND user_id = ? LIMIT 1',
      [client_id, req.user.id]
    );
    if (!clientRows.length) {
      return res.status(403).json({ message: 'Unknown client for this user' });
    }

    const accepted = [];
    const conflicts = [];
    const rejected = [];

    for (const change of changes) {
      const { entity, op, uuid, data, client_updated_at } = change;

      if (!ENTITY_TABLE[entity]) {
        rejected.push({ uuid, reason: 'unknown_entity' });
        continue;
      }

      const perm = requiredPermission(entity, op);
      if (perm && !hasPermission(req.user.permissions, perm)) {
        rejected.push({ uuid, reason: 'forbidden', missing: perm });
        await logChange(client_id, req.user.id, entity, uuid, op, 'forbidden', perm);
        continue;
      }

      try {
        const result = await applyChange(entity, op, uuid, data, client_updated_at);
        if (result.conflict) {
          conflicts.push({ uuid, reason: result.reason, server_row: result.server_row || null });
          await logChange(client_id, req.user.id, entity, uuid, op, 'conflict', result.reason);
        } else {
          accepted.push({ uuid, server_version: result.server_version });
          await logChange(client_id, req.user.id, entity, uuid, op, 'accepted', null);
        }
      } catch (err) {
        console.error('applyChange error:', err);
        rejected.push({ uuid, reason: 'server_error', detail: err.message });
        await logChange(client_id, req.user.id, entity, uuid, op, 'error', err.message);
      }
    }

    await pool.query(
      'UPDATE sync_clients SET last_push_at = NOW(), last_seen_at = NOW() WHERE client_id = ?',
      [client_id]
    );

    res.json({
      accepted,
      conflicts,
      rejected,
      server_time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error pushing changes:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ------------------------------------------------------------------
// POST /sync/push-receipt
// ------------------------------------------------------------------
exports.pushReceipt = async (req, res) => {
  const { client_id, uuid, op, receipt, client_updated_at } = req.body;

  if (!client_id || !uuid || !receipt) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const [clientRows] = await pool.query(
      'SELECT 1 FROM sync_clients WHERE client_id = ? AND user_id = ? LIMIT 1',
      [client_id, req.user.id]
    );
    if (!clientRows.length) {
      return res.status(403).json({ message: 'Unknown client for this user' });
    }

    if (!hasPermission(req.user.permissions, '2.3')) {
      return res.json({
        rejected: { reason: 'forbidden', missing: '2.3' }
      });
    }

    // Idempotency check
    if (receipt.serialNumber) {
      const [existingSales] = await pool.query(
        'SELECT 1 FROM sales WHERE serialNumber = ? LIMIT 1',
        [receipt.serialNumber]
      );
      
      if (existingSales.length) {
        console.log(`[Sync] Receipt ${receipt.serialNumber} already processed.`);
        await logChange(client_id, req.user.id, 'receipt', uuid, op, 'accepted', 'already_processed');
        return res.json({ accepted: true });
      }
    }

    await processReceipt(receipt, req.user);

    await logChange(client_id, req.user.id, 'receipt', uuid, op, 'accepted', null);
    res.json({ accepted: true });

  } catch (error) {
    console.error('pushReceipt error:', error);
    await logChange(client_id, req.user.id, 'receipt', uuid, op, 'error', error.message);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
};

// ------------------------------------------------------------------
// GET /sync/pull
// ------------------------------------------------------------------
exports.pullChanges = async (req, res) => {
  const since = req.query.since || '1970-01-01 00:00:00';
  const client_id = req.query.client_id;

  if (!client_id) {
    return res.status(400).json({ message: 'client_id required' });
  }

  try {
    const [clientRows] = await pool.query(
      'SELECT 1 FROM sync_clients WHERE client_id = ? AND user_id = ? LIMIT 1',
      [client_id, req.user.id]
    );
    if (!clientRows.length) {
      return res.status(403).json({ message: 'Unknown client' });
    }

    const canViewProducts = hasPermission(req.user.permissions, '3.3');
    const canViewSales    = hasPermission(req.user.permissions, '2.3');

    let products = [];
    let sales = [];

    if (canViewProducts) {
      // Changed to >= to fix the timing issue
      const [rows] = await pool.query(
        'SELECT * FROM products WHERE updated_at >= ?',
        [since]
      );
      products = rows;
    }

    if (canViewSales) {
      // Changed to >= to fix the timing issue
      const [rows] = await pool.query(
        'SELECT * FROM sales WHERE updated_at >= ?',
        [since]
      );
      sales = rows;
    }

    await pool.query(
      'UPDATE sync_clients SET last_pull_at = NOW(), last_seen_at = NOW() WHERE client_id = ?',
      [client_id]
    );

    res.json({
      products,
      sales,
      server_time: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error pulling changes:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------
async function processReceipt(receipt, user) {
  const { selectedProducts, paymentMode, amountPaid, username, clientName, clientPhone, serialNumber } = receipt;

  if (!selectedProducts || !selectedProducts.length) {
    throw new Error('No products in receipt');
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    let finalUserId = user.id;
    let finalUsername = username || user.username;

    const [userResult] = await connection.query(
      'SELECT id, username FROM users WHERE username = ?',
      [finalUsername]
    );
    if (userResult.length > 0) {
      finalUserId = userResult[0].id;
      finalUsername = userResult[0].username;
    }

    for (const item of selectedProducts) {
      const { product_id, quantity } = item;

      const [productResult] = await connection.query(
        'SELECT id, prod_name, sprice, cprice, quantity FROM products WHERE id = ? FOR UPDATE',
        [product_id]
      );

      if (productResult.length === 0) {
        throw new Error(`Product with id ${product_id} not found`);
      }

      const product = productResult[0];
      const availableQuantity = Number(product.quantity);

      if (availableQuantity < quantity) {
        throw new Error(`Insufficient stock for product: ${product.prod_name}`);
      }

      const sprice = Number(product.sprice);
      const cprice = Number(product.cprice);
      const total_amount = sprice * quantity;
      const profit = (sprice - cprice) * quantity;

      await connection.query(
        'UPDATE products SET quantity = quantity - ? WHERE id = ?',
        [quantity, product_id]
      );

      if (paymentMode !== 'credit') {
        const change_given = Number(amountPaid) - total_amount;
        const saleUuid = require('crypto').randomUUID();
        
        await connection.query(
          `INSERT INTO sales 
           (uuid, product_id, prod_name, quantity_sold, total_amount, amount_paid, change_given, payment_mode, user_id, username, profit, serialNumber)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            saleUuid, product_id, product.prod_name, quantity, total_amount, 
            amountPaid, change_given, paymentMode, finalUserId, 
            finalUsername, profit, serialNumber
          ]
        );
      }
    }

    if (paymentMode === 'credit') {
      const productPrices = [];
      for (const item of selectedProducts) {
        const [p] = await connection.query('SELECT sprice, cprice, prod_name FROM products WHERE id = ?', [item.product_id]);
        if (p.length > 0) {
           productPrices.push({ price: p[0].sprice, quantity: item.quantity, prod_name: p[0].prod_name, product_id: item.product_id });
        }
      }

      const totalAmount = productPrices.reduce((sum, { price, quantity }) => sum + (Number(price) * quantity), 0);
      const balance = totalAmount - Number(amountPaid);
      
      const productsJson = JSON.stringify(productPrices.map(p => ({
        product_id: p.product_id,
        quantity: p.quantity,
        prod_name: p.prod_name
      })));

      await connection.query(
        `INSERT INTO credit_sales (client_name, client_phone, total_amount, amount_paid, balance, products)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [clientName || 'Unknown', clientPhone || '000', totalAmount, amountPaid, balance, productsJson]
      );
    }

    await connection.commit();
    console.log(`[Sync] Receipt ${serialNumber} processed successfully`);

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function applyChange(entity, op, uuid, data, client_updated_at) {
  const table = ENTITY_TABLE[entity];
  const clean = pickAllowed(entity, data || {});
  const cleanSafe = coerceNumerics(entity, clean);

  if (op === 'create') {
    const [existing] = await pool.query(
      `SELECT server_version FROM ${table} WHERE uuid = ? LIMIT 1`,
      [uuid]
    );
    if (existing.length) {
      return applyUpdate(table, uuid, cleanSafe, client_updated_at);
    }

    const cols = Object.keys(cleanSafe);
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map(c => cleanSafe[c]);

    await pool.query(
      `INSERT INTO ${table} (uuid, ${cols.join(', ')}, updated_at, server_version)
       VALUES (?, ${placeholders}, NOW(), 1)`,
      [uuid, ...values]
    );
    return { server_version: 1 };
  }

  if (op === 'update') {
    return applyUpdate(table, uuid, cleanSafe, client_updated_at);
  }

  if (op === 'delete') {
    const [rows] = await pool.query(
      `SELECT server_version FROM ${table} WHERE uuid = ? LIMIT 1`,
      [uuid]
    );
    if (!rows.length) return { conflict: true, reason: 'not_found' };

    await pool.query(
      `UPDATE ${table}
       SET deleted_at = NOW(), updated_at = NOW(), server_version = server_version + 1
       WHERE uuid = ?`,
      [uuid]
    );
    return { server_version: rows[0].server_version + 1 };
  }

  throw new Error('Unknown op: ' + op);
}

async function applyUpdate(table, uuid, data, client_updated_at) {
  const entity = table === 'products' ? 'product' : 'sale';
  const cleanData = coerceNumerics(entity, data || {});

  const [rows] = await pool.query(
    `SELECT updated_at, server_version FROM ${table} WHERE uuid = ? LIMIT 1`,
    [uuid]
  );
  if (!rows.length) return { conflict: true, reason: 'not_found' };

  const server = rows[0];
  const serverTime = new Date(server.updated_at).getTime();
  const clientTime = client_updated_at ? new Date(client_updated_at).getTime() : 0;

  if (clientTime && serverTime > clientTime) {
    return { conflict: true, reason: 'server_newer', server_row: server };
  }

  const cols = Object.keys(cleanData);
  if (!cols.length) return { server_version: server.server_version };

  const setClause = cols.map(c => `${c} = ?`).join(', ');
  const values = cols.map(c => cleanData[c]);

  await pool.query(
    `UPDATE ${table}
     SET ${setClause}, updated_at = NOW(), server_version = server_version + 1
     WHERE uuid = ?`,
    [...values, uuid]
  );

  return { server_version: server.server_version + 1 };
}

async function logChange(client_id, user_id, entity, uuid, op, status, note) {
  try {
    await pool.query(
      `INSERT INTO sync_log (client_id, user_id, entity, entity_uuid, op, status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [client_id, user_id, entity, uuid, op, status, note]
    );
  } catch (err) {
    console.error('sync_log write failed:', err.message);
  }
}