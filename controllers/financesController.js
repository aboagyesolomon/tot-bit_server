const pool = require('../config/db');

// Create a new transaction
exports.createTransaction = (req, res) => {
  const { type, description, amount, payment_method, purpose } = req.body;

  pool.query(
    'INSERT INTO transactions (type, description, amount, payment_method, purpose) VALUES (?, ?, ?, ?, ?)',
    [type, description, amount, payment_method, purpose],
    (error, result) => {
      if (error) {
        console.error('Error inserting transaction:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json({ id: result.insertId, message: 'Transaction created successfully' });
    }
  );
};

// Get all transactions
exports.getAllTransactions = (req, res) => {
  pool.query('SELECT * FROM transactions', (error, transactions) => {
    if (error) {
      console.error('Error fetching transactions:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json(transactions);
  });
};

// Get transactions by type (expense or purchase)
exports.getTransactionsByType = (req, res) => {
  const { type } = req.params;

  pool.query('SELECT * FROM transactions WHERE type = ?', [type], (error, transactions) => {
    if (error) {
      console.error('Error fetching transactions by type:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (transactions.length === 0) {
      return res.status(404).json({ message: `No transactions found for type: ${type}` });
    }
    res.json(transactions);
  });
};

// Get a transaction by ID
exports.getTransactionById = (req, res) => {
  const { id } = req.params;

  pool.query('SELECT * FROM transactions WHERE id = ?', [id], (error, transaction) => {
    if (error) {
      console.error('Error fetching transaction by ID:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (transaction.length === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.json(transaction[0]);
  });
};

// Update a transaction
exports.updateTransaction = (req, res) => {
  const { id } = req.params;
  const { type, description, amount, payment_method } = req.body;

  pool.query(
    'UPDATE transactions SET type = ?, description = ?, amount = ?, payment_method = ? WHERE id = ?',
    [type, description, amount, payment_method, id],
    (error, result) => {
      if (error) {
        console.error('Error updating transaction:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.json({ message: 'Transaction updated successfully' });
    }
  );
};

// Delete a transaction
exports.deleteTransaction = (req, res) => {
  const { id } = req.params;

  pool.query('DELETE FROM transactions WHERE id = ?', [id], (error, result) => {
    if (error) {
      console.error('Error deleting transaction:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json({ message: 'Transaction deleted successfully' });
  });
};

// Node.js: Get alerts for high-value transactions and unusual activity
exports.getTransactionAlerts = (req, res) => {
  const highValueThreshold = 1000; // Example threshold for high-value transactions

  pool.query('SELECT * FROM transactions', (error, transactions) => {
    if (error) {
      console.error('Error fetching transactions:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // Filter for high-value transactions
    const highValueTransactions = transactions.filter(transaction => transaction.amount >= highValueThreshold);

    // Send the filtered data back to the front-end
    res.json({
      highValueTransactions: highValueTransactions.map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount,
      })),
    });
  });
};
