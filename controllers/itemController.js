const pool = require('../config/db');

// Create a new product
exports.createProduct = (req, res) => {
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

  pool.query(
    `INSERT INTO products (
      prod_name, brand, prod_manu, quantity, manu_date, expire_date, 
      cprice, sprice, mark_up, category, description, supplier_name, 
      meas_type, min_quantity, barcode, tax, discount, final_price, 
      total_amount, payment_method, profit_amount, 
      unit_per_quantity, unit_price, profit_per_unit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      prod_name, brand, prod_manu, quantity, manu_date, expire_date, cprice, 
      sprice, mark_up, category, description, supplier_name, meas_type, 
      min_quantity, barcode, tax, discount, final_price, total_amount, 
      payment_method, profit_amount, unit_per_quantity, 
      unit_price, profit_per_unit
    ],
    (error, result) => {
      if (error) {
        console.error('Error inserting product:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json({ id: result.insertId, message: 'Product created successfully' });
    }
  );
};



// Get all products
exports.getAllProducts = (req, res) => {
  pool.query('SELECT * FROM products', (error, products) => {
    if (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json(products);
  });
};

// Get a product by ID
exports.getProductById = (req, res) => {
  const { id } = req.params;
  pool.query('SELECT * FROM products WHERE id = ?', [id], (error, product) => {
    if (error) {
      console.error('Error fetching product by ID:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (product.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product[0]);
  });
};

// Update a product
exports.updateProduct = (req, res) => {
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

  pool.query('SELECT * FROM products WHERE id = ?', [id], (error, products) => {
    if (error) {
      console.error('Error fetching product for update:', error);
      return res.status(500).json({ error: 'Internal Server Error during fetching product for update' });
    }

    if (products.length === 0) {
      console.warn(`Product with id ${id} not found`);
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingProduct = products[0];
    const existingQuantity = parseInt(existingProduct.quantity, 10);
    const minQuantity = parseInt(existingProduct.min_quantity, 10);

    let updatedQuantity = existingQuantity;

    if (existingQuantity <= minQuantity) {
      updatedQuantity += newQuantityToAdd;
    } else {
      updatedQuantity = newQuantityToAdd;
    }

    console.log('Preparing to update product with ID:', id);
    console.log('Updated Quantity:', updatedQuantity);

   
let profit_per_unit = sprice - cprice; 

pool.query(
    'UPDATE products SET prod_name = ?, brand = ?, prod_manu = ?, quantity = ?, manu_date = ?, expire_date = ?, cprice = ?, sprice = ?, mark_up = ?, category = ?, description = ?, supplier_name = ?, min_quantity = ?, barcode = ?, tax = ?, discount = ?, total_amount = ?, payment_method = ?, amount_paid = ?, profit_amount = ?, unit_per_quantity = ?, unit_price = ?, profit_per_unit = ? WHERE id = ?',
    [
        prod_name,
        brand,
        prod_manu,
        updatedQuantity,
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
        profit_per_unit,   
        id,
    ],
    (error, result) => {
        if (error) {
            console.error('Error executing update query:', error);
            return res.status(500).json({ error: 'Internal Server Error during update query' });
        }

        if (result.affectedRows === 0) {
            console.warn(`No rows were updated for product ID ${id}`);
            return res.status(404).json({ message: 'No product was updated' });
        }

        console.log('Product updated successfully:', result);
        res.json({ message: 'Product updated successfully', updatedQuantity });
    }
);

  });
};


// Delete a product
exports.deleteProduct = (req, res) => {
  const { id } = req.params;

  pool.query('DELETE FROM products WHERE id = ?', [id], (error, result) => {
    if (error) {
      console.error('Error deleting product:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json({ message: 'Product deleted successfully' });
  });
};

exports.getAlerts = (req, res) => {
  const today = new Date();
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setDate(today.getDate());
  threeMonthsFromNow.setMonth(today.getMonth() + 3);

  pool.query(
    'SELECT id, prod_name, expire_date, quantity, min_quantity FROM products WHERE expire_date BETWEEN ? AND ? OR quantity <= min_quantity',
    [today, threeMonthsFromNow],
    (error, products) => {
      if (error) {
        console.error('Error fetching alerts:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      const expiringProducts = products.filter(product => product.expire_date && new Date(product.expire_date) <= threeMonthsFromNow);
      const lowStockProducts = products.filter(product => product.quantity <= product.min_quantity);

      res.json({
        expiringProducts: expiringProducts.map(({ id, prod_name, expire_date }) => ({
          id, prod_name, expire_date,
        })),
        lowStockProducts: lowStockProducts.map(({ id, prod_name, quantity, min_quantity }) => ({
          id, prod_name, quantity, min_quantity,
        })),
      });
    }
  );
};

