const pool = require('../config/db');

// Helper function to generate a unique invoice number
const generateInvoiceNumber = async () => {
  try {
    const [rows] = await pool.query('SELECT COUNT(id) AS invoice_count FROM invoices');
    const invoice_count = rows[0]?.invoice_count || 0;
    const paddedNumber = (invoice_count + 1).toString().padStart(4, '0');
    return `INV${paddedNumber}`;
  } catch (err) {
    throw new Error('Could not generate invoice number');
  }
};

// Create a new invoice
exports.createInvoice = async (req, res) => {
  const { client_name, issue_date, total_amount, amount_paid, status } = req.body;

  try {
    // Generate the invoice number
    const invoice_number = await generateInvoiceNumber();

    // Calculate the balance
    const balance = total_amount - (amount_paid || 0);

    // Insert the invoice into the database
    const query = `
      INSERT INTO invoice (client_name, invoice_number, issue_date, total_amount, amount_paid, balance, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.query(query, [client_name, invoice_number, issue_date, total_amount, amount_paid, balance, status]);

    res.status(201).json({ message: 'Invoice created successfully', invoice_number });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

// Get all invoices
exports.getAllInvoices = async (req, res) => {
  try {
    const [invoices] = await pool.query('SELECT * FROM invoice');
    res.status(200).json(invoices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

// Get an invoice by ID
exports.getInvoiceById = async (req, res) => {
  const { id } = req.params;

  try {
    const [invoice] = await pool.query('SELECT * FROM invoices WHERE id = ?', [id]);

    if (invoice.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.status(200).json(invoice[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

// Update an invoice by ID
exports.updateInvoice = async (req, res) => {
  const { id } = req.params;
  const { client_name, issue_date, total_amount, amount_paid, status } = req.body;

  try {
    // Recalculate the balance
    const balance = total_amount - (amount_paid || 0);

    const query = `
      UPDATE invoices
      SET client_name = ?, issue_date = ?, total_amount = ?, amount_paid = ?, balance = ?, status = ?
      WHERE id = ?
    `;

    const [result] = await pool.query(query, [client_name, issue_date, total_amount, amount_paid, balance, status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.status(200).json({ message: 'Invoice updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
};

// Delete an invoice by ID
exports.deleteInvoice = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM invoices WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
};
