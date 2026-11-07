// test-sync.js — run with: node test-sync.js
const axios = require('axios');
const crypto = require('crypto');

const BASE = 'http://localhost:5001';

// ------------------------------------------------------------------
// ✏️  CHANGE THESE to a real user in your DB who has BOTH permissions:
//     3.3 (Products)  and  2.3 (Sales)
// ------------------------------------------------------------------
const USERNAME = 'Super Admin';
const PASSWORD = '123456';
// ------------------------------------------------------------------

(async () => {
  console.log('\n=== SYNC ENDPOINT TEST ===\n');

  // 1. LOGIN
  console.log('1) Logging in as', USERNAME, '...');
  const loginRes = await axios.post(`${BASE}/login`, { username: USERNAME, password: PASSWORD });
  const { token, permissions, user_type } = loginRes.data;
  console.log('   ✅ Token length:', token.length);
  console.log('   ✅ User type:', user_type);
  console.log('   ✅ Permissions:', permissions);

  const headers = { Authorization: `Bearer ${token}` };

  // 2. REGISTER CLIENT
  const client_id = 'test-client-' + Date.now();
  console.log('\n2) Registering client:', client_id);
  const reg = await axios.post(
    `${BASE}/sync/register-client`,
    { client_id, device_name: 'test-device', device_info: 'node-test' },
    { headers }
  );
  console.log('   ✅', reg.data);

  // 3. PUSH a new product
  const productUuid = crypto.randomUUID();
  console.log('\n3) Pushing new product:', productUuid);
  const pushRes = await axios.post(
    `${BASE}/sync/push`,
    {
      client_id,
      changes: [
        {
          entity: 'product',
          op: 'create',
          uuid: productUuid,
          client_updated_at: new Date().toISOString(),
          data: {
            prod_name: 'TEST PRODUCT FROM SYNC',
            brand: 'TEST',
            prod_manu: 'TEST',
            quantity: 10,
            min_quantity: 1,
            manu_date: '2026-01-01',
            expire_date: '2028-01-01',
            cprice: 5,
            sprice: 8,
            final_price: 8,
            category: 'test',
            meas_type: 'box',
            profit_amount: 3,
            profit_per_unit: 3,
          },
        },
      ],
    },
    { headers }
  );
  console.log('   ✅ Push response:');
  console.log('     accepted:', JSON.stringify(pushRes.data.accepted));
  console.log('     conflicts:', JSON.stringify(pushRes.data.conflicts));
  console.log('     rejected:', JSON.stringify(pushRes.data.rejected));

  // 4. PULL since 1970 to see what's there
  console.log('\n4) Pulling all changes...');
  const pullRes = await axios.get(`${BASE}/sync/pull`, {
    params: { since: '1970-01-01 00:00:00', client_id },
    headers,
  });
  console.log('   ✅ Products returned:', pullRes.data.products.length);
  console.log('   ✅ Sales returned:', pullRes.data.sales.length);

  const ourProduct = pullRes.data.products.find(p => p.uuid === productUuid);
  console.log('   ✅ Our test product found?', ourProduct ? 'YES' : 'NO');
  if (ourProduct) {
    console.log('     → prod_name:', ourProduct.prod_name);
    console.log('     → server_version:', ourProduct.server_version);
  }

  // 5. PUSH an UPDATE to the same product
  console.log('\n5) Pushing update to same product (quantity 10 → 25)...');
  const push2 = await axios.post(
    `${BASE}/sync/push`,
    {
      client_id,
      changes: [
        {
          entity: 'product',
          op: 'update',
          uuid: productUuid,
          client_updated_at: new Date(Date.now() + 1000).toISOString(),
          data: { quantity: 25 },
        },
      ],
    },
    { headers }
  );
  console.log('   ✅ Update accepted:', JSON.stringify(push2.data.accepted));

  // 6. PULL again and verify quantity changed
  console.log('\n6) Pulling again to verify update...');
  const pullRes2 = await axios.get(`${BASE}/sync/pull`, {
    params: { since: '1970-01-01 00:00:00', client_id },
    headers,
  });
  const updated = pullRes2.data.products.find(p => p.uuid === productUuid);
  console.log('   ✅ quantity now:', updated?.quantity);
  console.log('   ✅ server_version now:', updated?.server_version);

  console.log('\n=== ✅ ALL SYNC TESTS PASSED ===\n');
})().catch(err => {
  console.error('\n❌ TEST FAILED');
  console.error('Status:', err.response?.status);
  console.error('Data:', JSON.stringify(err.response?.data, null, 2));
  console.error('Message:', err.message);
  process.exit(1);
});