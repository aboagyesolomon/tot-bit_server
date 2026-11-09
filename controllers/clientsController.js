const pool = require('../config/db');

// Create a new client
exports.createClient = async (req, res) => {
  const { client_name, client_address, client_telephone, client_type } = req.body;

  if (!client_name || !client_address || !client_telephone || !client_type) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const query = `INSERT INTO clients (client_name, client_address, client_telephone, client_type) 
                 VALUES ($1, $2, $3, $4) RETURNING id`;

  try {
    const { rows } = await pool.query(query, [client_name, client_address, client_telephone, client_type]);
    res.status(201).json({ message: 'Client created successfully', clientId: rows[0].id });
  } catch (err) {
    console.error('Error creating client:', err);
    return res.status(500).json({ error: 'Error creating client' });
  }
};

// Get all clients or search for clients
exports.getAllClients = async (req, res) => {
  const { search } = req.query;

  let query = 'SELECT * FROM clients';
  let queryParams = [];

  if (search) {
    query += ' WHERE client_name ILIKE $1'; // ILIKE is case-insensitive in PostgreSQL
    queryParams.push(`%${search}%`);
  }

  try {
    const { rows } = await pool.query(query, queryParams);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching clients:', err);
    return res.status(500).json({ error: 'Error fetching clients' });
  }
};

// Get a single client by ID
exports.getClientById = async (req, res) => {
  const clientId = req.params.id;
  const query = 'SELECT * FROM clients WHERE id = $1';

  try {
    const { rows } = await pool.query(query, [clientId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching client:', err);
    return res.status(500).json({ error: 'Error fetching client' });
  }
};

// Update client information
exports.updateClient = async (req, res) => {
  const clientId = req.params.id;
  const { client_name, client_address, client_telephone, client_type } = req.body;

  const query = `UPDATE clients SET client_name = $1, client_address = $2, client_telephone = $3, client_type = $4 
                 WHERE id = $5`;

  try {
    const result = await pool.query(query, [client_name, client_address, client_telephone, client_type, clientId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'Client updated successfully' });
  } catch (err) {
    console.error('Error updating client:', err);
    return res.status(500).json({ error: 'Error updating client' });
  }
};

// Delete a client by ID
exports.deleteClient = async (req, res) => {
  const clientId = req.params.id;
  const query = 'DELETE FROM clients WHERE id = $1';

  try {
    const result = await pool.query(query, [clientId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'Client deleted successfully' });
  } catch (err) {
    console.error('Error deleting client:', err);
    return res.status(500).json({ error: 'Error deleting client' });
  }
};