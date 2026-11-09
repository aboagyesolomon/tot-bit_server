const pool = require('../config/db');

exports.createSale = async (req, res) => {
  const { selectedProducts, paymentMode, amountPaid, username, clientName, clientPhone, serialNumber } = req.body;

  console.log('Request received:', req.body);  

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const getUserQuery = 'SELECT id FROM users WHERE username = $1';
    const userResult = await client.query(getUserQuery, [username]);

    if (!userResult.rows || userResult.rows.length === 0) {
      throw new Error(`User with username ${username} not found`);
    }

    const { id: user_id } = userResult.rows[0]; 

    await Promise.all(
      selectedProducts.map(async (product) => {
        const { product_id, quantity } = product;

        const getProductQuery = 'SELECT prod_name, sprice, cprice, quantity FROM products WHERE id = $1';
        const productResult = await client.query(getProductQuery, [product_id]);

        if (!productResult.rows || productResult.rows.length === 0) {
          throw new Error(`Product with id ${product_id} not found`);
        }

        const { prod_name, sprice, cprice, quantity: availableQuantity } = productResult.rows[0];

        if (Number(availableQuantity) < quantity) {
          throw new Error(`Insufficient stock for product: ${prod_name}`);
        }

        const total_amount = Number(sprice) * quantity;
        const profit = (Number(sprice) - Number(cprice)) * quantity;

        const updateProductQuery = 'UPDATE products SET quantity = quantity - $1 WHERE id = $2';
        await client.query(updateProductQuery, [quantity, product_id]);

        if (paymentMode !== 'credit') {
          const insertSaleQuery = `
            INSERT INTO sales (product_id, prod_name, quantity_sold, total_amount, amount_paid, change_given, payment_mode, user_id, username, profit, serialNumber)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `;
          await client.query(insertSaleQuery, [
            product_id,
            prod_name,
            quantity,
            total_amount,
            amountPaid,
            amountPaid - total_amount,
            paymentMode,
            user_id,
            username,
            profit,
            serialNumber
          ]);
        }
      })
    );

    if (paymentMode === 'credit') {
      const productPrices = await Promise.all(
        selectedProducts.map(async (product) => {
          const { product_id, quantity } = product;

          const getProductQuery = 'SELECT sprice, cprice FROM products WHERE id = $1';
          const productResult = await client.query(getProductQuery, [product_id]);

          if (!productResult.rows || productResult.rows.length === 0) {
            throw new Error(`Product with id ${product_id} not found`);
          }

          return { price: productResult.rows[0].sprice, cprice: productResult.rows[0].cprice, quantity }; 
        })
      );

      const totalAmount = productPrices.reduce((sum, { price, quantity }) => {
        return sum + (Number(price) * quantity);
      }, 0);

      const balance = totalAmount - amountPaid;

      const productsJson = JSON.stringify(selectedProducts.map(product => ({
        product_id: product.product_id,
        quantity: product.quantity,
        prod_name: product.prod_name, 
      })));

      const insertCreditSaleQuery = `
        INSERT INTO credit_sales (client_name, client_phone, total_amount, amount_paid, balance, products)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await client.query(insertCreditSaleQuery, [
        clientName,
        clientPhone,
        totalAmount,
        amountPaid,
        balance,
        productsJson,
      ]);
    }

    await client.query('COMMIT');
    console.log('Sale completed successfully');
    res.json({ message: 'Sale completed successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing sale:', error);
    res.status(500).send(error.message);
  } finally {
    client.release();
  }
};

exports.getAllSales = async (req, res) => {
  const query = `
    SELECT 
      sales.*,
      sale_id AS "saleId"
    FROM sales
    ORDER BY sale_date DESC;
  `;

  try {
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching sales:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getSaleById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const { rows } = await pool.query('SELECT * FROM sales WHERE sale_id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching sale by ID:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getAllCreditSales = async (req, res) => {
  const query = `SELECT * FROM credit_sales;`;

  try {
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching credit sales:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getCreditSaleById = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query('SELECT * FROM credit_sales WHERE id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Credit sale not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching credit sale by ID:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateCreditSale = async (req, res) => {
  const { id } = req.params;
  const { client_name, client_phone, total_amount, amount_paid, products } = req.body;

  const balance = parseFloat(total_amount) - parseFloat(amount_paid);

  const updateQuery = `
    UPDATE credit_sales 
    SET client_name = $1, client_phone = $2, total_amount = $3, amount_paid = $4, balance = $5, products = $6
    WHERE id = $7;
  `;

  try {
    const result = await pool.query(
      updateQuery,
      [client_name, client_phone, total_amount, amount_paid, balance, JSON.stringify(products), id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Credit sale not found' });
    }
    res.json({ message: 'Credit sale updated successfully', balance });
  } catch (error) {
    console.error('Error updating credit sale:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteCreditSale = async (req, res) => {
  const { id } = req.params;

  const deleteQuery = 'DELETE FROM credit_sales WHERE id = $1';

  try {
    const result = await pool.query(deleteQuery, [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Credit sale not found' });
    }
    res.json({ message: 'Credit sale deleted successfully' });
  } catch (error) {
    console.error('Error deleting credit sale:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateSaleAfterReturn = async (req, res) => {
  const { saleId, newQuantity } = req.body;

  const parsedSaleId = Number(saleId);
  const parsedQuantity = Number(newQuantity);

  if (!Number.isInteger(parsedSaleId) || parsedSaleId <= 0) {
    return res.status(400).json({ error: 'Invalid sale ID', received: req.body });
  }

  if (Number.isNaN(parsedQuantity) || parsedQuantity < 0) {
    return res.status(400).json({ error: 'Invalid quantity', received: req.body });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const saleResult = await client.query('SELECT * FROM sales WHERE sale_id = $1', [parsedSaleId]);

    if (!saleResult.rows.length) {
      throw new Error('Sale not found');
    }

    const sale = saleResult.rows[0];

    const oldQty = Number(sale.quantity_sold);
    const qtyDiff = oldQty - parsedQuantity;

    if (qtyDiff > 0) {
      await client.query('UPDATE products SET quantity = quantity + $1 WHERE id = $2', [qtyDiff, sale.product_id]);
    }

    if (parsedQuantity === 0) {
      await client.query('DELETE FROM sales WHERE sale_id = $1', [parsedSaleId]);
      await client.query('COMMIT');
      return res.json({ message: 'Sale item removed successfully' });
    }

    const productResult = await client.query('SELECT cprice FROM products WHERE id = $1', [sale.product_id]);

    if (!productResult.rows.length) {
      throw new Error('Product not found');
    }

    const cprice = Number(productResult.rows[0].cprice);
    const oldTotal = Number(sale.total_amount);
    const unitPrice = oldTotal / oldQty;

    const newTotal = unitPrice * parsedQuantity;
    const newProfit = (unitPrice - cprice) * parsedQuantity;

    await client.query(
      'UPDATE sales SET quantity_sold = $1, total_amount = $2, profit = $3 WHERE sale_id = $4',
      [parsedQuantity, newTotal, newProfit, parsedSaleId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Sale updated successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.addProductToExistingReceipt = async (req, res) => {
  const { serialNumber, productId, product_id, quantity, paymentMode, username, amountPaid } = req.body;

  const parsedProductId = Number(productId || product_id);
  const parsedQuantity = Number(quantity);

  if (!serialNumber) return res.status(400).json({ error: 'Serial number is required' });
  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) return res.status(400).json({ error: 'Invalid product ID' });
  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) return res.status(400).json({ error: 'Invalid quantity' });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const originalSaleResult = await client.query(
      'SELECT user_id, username, payment_mode FROM sales WHERE serialnumber = $1 LIMIT 1',
      [serialNumber]
    );

    if (!originalSaleResult.rows.length) {
      throw new Error('Original receipt not found');
    }

    const originalSale = originalSaleResult.rows[0];

    let finalUsername = username || originalSale.username;
    let finalUserId = originalSale.user_id;
    const finalPaymentMode = paymentMode || originalSale.payment_mode;

    if (finalUsername) {
      const userResult = await client.query('SELECT id FROM users WHERE username = $1', [finalUsername]);
      if (userResult.rows.length) {
        finalUserId = userResult.rows[0].id;
      }
    }

    const productResult = await client.query(
      'SELECT prod_name, sprice, cprice, quantity FROM products WHERE id = $1',
      [parsedProductId]
    );

    if (!productResult.rows.length) {
      throw new Error('Product not found');
    }

    const product = productResult.rows[0];

    if (Number(product.quantity) < parsedQuantity) {
      throw new Error(`Insufficient stock for product: ${product.prod_name}`);
    }

    const sprice = Number(product.sprice);
    const cprice = Number(product.cprice);

    const totalAmount = sprice * parsedQuantity;
    const profit = (sprice - cprice) * parsedQuantity;

    const paidAmount = amountPaid !== undefined && amountPaid !== null ? Number(amountPaid) : totalAmount;

    if (Number.isNaN(paidAmount) || paidAmount < 0) {
      throw new Error('Invalid amount paid');
    }

    await client.query('UPDATE products SET quantity = quantity - $1 WHERE id = $2', [parsedQuantity, parsedProductId]);

    await client.query(
      `INSERT INTO sales 
        (product_id, prod_name, quantity_sold, total_amount, amount_paid, change_given, payment_mode, user_id, username, profit, serialNumber)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        parsedProductId, product.prod_name, parsedQuantity, totalAmount, paidAmount, 
        paidAmount - totalAmount, finalPaymentMode, finalUserId, finalUsername, profit, serialNumber
      ]
    );

    await client.query('COMMIT');
    res.json({ message: 'Product added to receipt successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.getDailySalesTotals = async (req, res) => {
  // PostgreSQL Date functions: sale_date::date and CURRENT_DATE - INTERVAL '30 days'
  const query = `
    SELECT 
      sale_date::date AS sale_date,
      SUM(total_amount) AS total_sales,
      SUM(profit) AS total_profit,
      COUNT(*) AS total_items
    FROM sales
    WHERE sale_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY sale_date::date
    ORDER BY sale_date DESC;
  `;

  try {
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching daily sales totals:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};