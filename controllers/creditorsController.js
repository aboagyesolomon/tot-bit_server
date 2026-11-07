// creditorController.js
const pool = require('../config/db');

// Get all creditors
exports.getAllCreditors = async (req, res) => {
  try {
    const results = await pool.query('SELECT * FROM creditors ORDER BY id');
    res.status(200).json(results.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get creditor by ID
exports.getCreditorById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM creditors WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Creditor not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new creditor
// creditorController.js

// Create a new creditor
exports.createCreditor = async (req, res) => {
    const { creditor_name, creditor_phone, total_amount, amount_paid, product, quantity, payment_method, description } = req.body;
    
    // Automatically calculate balance
    const balance = total_amount - amount_paid;
  
    try {
      const result = await pool.query(
        'INSERT INTO creditors (creditor_name, creditor_phone, total_amount, amount_paid, balance, product, quantity, payment_method, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [creditor_name, creditor_phone, total_amount, amount_paid, balance, product, quantity, payment_method, description]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  
  // Update a creditor
  exports.updateCreditor = async (req, res) => {
    const { id } = req.params;
    const { creditor_name, creditor_phone, total_amount, amount_paid, product, quantity, payment_method, description } = req.body;
    
    // Automatically calculate balance
    const balance = total_amount - amount_paid;
  
    try {
      const result = await pool.query(
        'UPDATE creditors SET creditor_name = $1, creditor_phone = $2, total_amount = $3, amount_paid = $4, balance = $5, product = $6, quantity = $7, payment_method = $8, description = $9 WHERE id = $10 RETURNING *',
        [creditor_name, creditor_phone, total_amount, amount_paid, balance, product, quantity, payment_method, description, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Creditor not found' });
      }
      res.status(200).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  

// Update a creditor
exports.updateCreditor = async (req, res) => {
  const { id } = req.params;
  const { creditor_name, creditor_phone, total_amount, amount_paid, balance, product, quantity, payment_method, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE creditors SET creditor_name = $1, creditor_phone = $2, total_amount = $3, amount_paid = $4, balance = $5, product = $6, quantity = $7, payment_method = $8, description = $9 WHERE id = $10 RETURNING *',
      [creditor_name, creditor_phone, total_amount, amount_paid, balance, product, quantity, payment_method, description, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Creditor not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a creditor
exports.deleteCreditor = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM creditors WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Creditor not found' });
    }
    res.status(200).json({ message: 'Creditor deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
