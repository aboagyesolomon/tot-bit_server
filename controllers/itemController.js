const pool = require('../config/db');

// Create a new product
exports.createProduct = async (req, res) => {
  const {
    prod_name,
    brand,
    prod_manu,
    quantity,
    manu_date,
    expire_date,
    cprice,
    sprice,
    mark_up,
    category,
    description,
    supplier_name,
    meas_type,
    min_quantity,
    barcode,
    tax = 0,
    discount = 0,
    final_price,
    total_amount,
    payment_method,
    amount_paid,
    profit_amount,
    unit_per_quantity = 1,
    unit_price = 0.00,
    profit_per_unit = sprice - cprice, 
  } = req.body;

  const query = `
    INSERT INTO products (
      prod_name, brand, prod_manu, quantity, manu_date, expire_date, 
      cprice, sprice, mark_up, category, description, supplier_name, 
      meas_type, min_quantity, barcode, tax, discount, final_price, 
      total_amount, payment_method, profit_amount, 
      unit_per_quantity, unit_price, profit_per_unit
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) 
    RETURNING id
  `;

  const values = [
    prod_name, brand, prod_manu, quantity, manu_date, expire_date, cprice, 
    sprice, mark_up, category, description, supplier_name, meas_type, 
    min_quantity, barcode, tax, discount, final_price, total_amount, 
    payment_method, profit_amount, unit_per_quantity, 
    unit_price, profit_per_unit
  ];

  try {
    const { rows } = await pool.query(query, values);
    res.json({ id: rows[0].id, message: 'Product created successfully' });
  } catch (error) {
    console.error('Error inserting product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get a product by ID
exports.getProductById = async (req, res) => {
  const { id } = req.params;
  
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const {
    prod_name,
    brand,
    prod_manu,
    quantity,
    manu_date,
    expire_date,
    cprice,
    sprice,
    mark_up,
    category,
    description,
    supplier_name,
    min_quantity,
    barcode,
    tax,
    discount,
    total_amount,      
    payment_method,   
    amount_paid,
    profit_amount,
    unit_per_quantity,
    unit_price,
  } = req.body;

  const newQuantityToAdd = parseInt(quantity, 10);

  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);

    if (rows.length === 0) {
      console.warn(`Product with id ${id} not found`);
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingProduct = rows[0];
    const existingQuantity = parseInt(existingProduct.quantity, 10);
    const minQuantity = parseInt(existingProduct.min_quantity, 10);

    let updatedQuantity = existingQuantity;

    if (existingQuantity <= minQuantity) {
      updatedQuantity += newQuantityToAdd;
    } else {
      updatedQuantity = newQuantityToAdd;
    }

    let profit_per_unit = sprice - cprice; 

    const updateQuery = `
      UPDATE products SET 
        prod_name = $1, brand = $2, prod_manu = $3, quantity = $4, 
        manu_date = $5, expire_date = $6, cprice = $7, sprice = $8, 
        mark_up = $9, category = $10, description = $11, supplier_name = $12, 
        min_quantity = $13, barcode = $14, tax = $15, discount = $16, 
        total_amount = $17, payment_method = $18, amount_paid = $19, 
        profit_amount = $20, unit_per_quantity = $21, unit_price = $22, 
        profit_per_unit = $23 
      WHERE id = $24
    `;

    const updateValues = [
      prod_name, brand, prod_manu, updatedQuantity, manu_date, expire_date, 
      cprice, sprice, mark_up, category, description, supplier_name, 
      min_quantity, barcode, tax, discount, total_amount, payment_method, 
      amount_paid, profit_amount, unit_per_quantity, unit_price, 
      profit_per_unit, id
    ];

    const updateResult = await pool.query(updateQuery, updateValues);

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ message: 'No product was updated' });
    }

    res.json({ message: 'Product updated successfully', updatedQuantity });
  } catch (error) {
    console.error('Error executing update query:', error);
    res.status(500).json({ error: 'Internal Server Error during update query' });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getAlerts = async (req, res) => {
  const today = new Date();
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setDate(today.getDate());
  threeMonthsFromNow.setMonth(today.getMonth() + 3);

  try {
    const { rows } = await pool.query(
      'SELECT id, prod_name, expire_date, quantity, min_quantity FROM products WHERE expire_date BETWEEN $1 AND $2 OR quantity <= min_quantity',
      [today, threeMonthsFromNow]
    );

    const expiringProducts = rows.filter(product => product.expire_date && new Date(product.expire_date) <= threeMonthsFromNow);
    const lowStockProducts = rows.filter(product => product.quantity <= product.min_quantity);

    res.json({
      expiringProducts: expiringProducts.map(({ id, prod_name, expire_date }) => ({
        id, prod_name, expire_date,
      })),
      lowStockProducts: lowStockProducts.map(({ id, prod_name, quantity, min_quantity }) => ({
        id, prod_name, quantity, min_quantity,
      })),
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};