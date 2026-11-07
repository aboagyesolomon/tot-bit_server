const pool = require('../config/db');

// Create a new client
exports.createClient = (req, res) => {
  const { client_name, client_address, client_telephone, client_type } = req.body;

  if (!client_name || !client_address || !client_telephone || !client_type) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Optionally encrypt the client data before saving
  // const encrypted_name = encrypt(client_name);
  // const encrypted_address = encrypt(client_address);
  // const encrypted_telephone = encrypt(client_telephone);

  const query = `INSERT INTO clients (client_name, client_address, client_telephone, client_type) 
                 VALUES (?, ?, ?, ?)`;

  pool.query(query, [client_name, client_address, client_telephone, client_type], (err, result) => {
    if (err) {
      console.error('Error creating client:', err);
      return res.status(500).json({ error: 'Error creating client' });
    }
    res.status(201).json({ message: 'Client created successfully', clientId: result.insertId });
  });
};

// Get all clients or search for clients
exports.getAllClients = (req, res) => {
  const { search } = req.query;

  // If there's a search query, filter clients by name
  let query = 'SELECT * FROM clients';
  let queryParams = [];

  if (search) {
    query += ' WHERE client_name LIKE ?';
    queryParams.push(`%${search}%`);
  }

  pool.query(query, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching clients:', err);
      return res.status(500).json({ error: 'Error fetching clients' });
    }
    res.json(results);
  });
};

// Get a single client by ID
exports.getClientById = (req, res) => {
  const clientId = req.params.id;
  const query = 'SELECT * FROM clients WHERE id = ?';

  pool.query(query, [clientId], (err, result) => {
    if (err) {
      console.error('Error fetching client:', err);
      return res.status(500).json({ error: 'Error fetching client' });
    }
    if (result.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(result[0]);
  });
};

// Update client information
exports.updateClient = (req, res) => {
  const clientId = req.params.id;
  const { client_name, client_address, client_telephone, client_type, mode_payment } = req.body;

  const query = `UPDATE clients SET client_name = ?, client_address = ?, client_telephone = ?, client_type = ? 
                 WHERE id = ?`;

  pool.query(query, [client_name, client_address, client_telephone, client_type, clientId], (err, result) => {
    if (err) {
      console.error('Error updating client:', err);
      return res.status(500).json({ error: 'Error updating client' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'Client updated successfully' });
  });
};

// Delete a client by ID
exports.deleteClient = (req, res) => {
  const clientId = req.params.id;
  const query = 'DELETE FROM clients WHERE id = ?';

  pool.query(query, [clientId], (err, result) => {
    if (err) {
      console.error('Error deleting client:', err);
      return res.status(500).json({ error: 'Error deleting client' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'Client deleted successfully' });
  });
};
