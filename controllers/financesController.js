const pool = require('../config/db');

// Create a new transaction
exports.createTransaction = async (req, res) => {
  const { type, description, amount, payment_method, purpose } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO transactions (type, description, amount, payment_method, purpose) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [type, description, amount, payment_method, purpose]
    );
    res.json({ id: result.rows[0].id, message: 'Transaction created successfully' });
  } catch (error) {
    console.error('Error inserting transaction:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get all transactions
exports.getAllTransactions = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM transactions');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get transactions by type (expense or purchase)
exports.getTransactionsByType = async (req, res) => {
  const { type } = req.params;

  try {
    const { rows } = await pool.query('SELECT * FROM transactions WHERE type = $1', [type]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: `No transactions found for type: ${type}` });
    }
    res.json(rows);
  } catch (error) {
    console.error('Error fetching transactions by type:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get a transaction by ID
exports.getTransactionById = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching transaction by ID:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Update a transaction
exports.updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { type, description, amount, payment_method } = req.body;

  try {
    const result = await pool.query(
      'UPDATE transactions SET type = $1, description = $2, amount = $3, payment_method = $4 WHERE id = $5',
      [type, description, amount, payment_method, id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json({ message: 'Transaction updated successfully' });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Delete a transaction
exports.deleteTransaction = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get alerts for high-value transactions and unusual activity
exports.getTransactionAlerts = async (req, res) => {
  const highValueThreshold = 1000;

  try {
    const { rows } = await pool.query('SELECT * FROM transactions');

    const highValueTransactions = rows.filter(transaction => transaction.amount >= highValueThreshold);

    res.json({
      highValueTransactions: highValueTransactions.map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount,
      })),
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};