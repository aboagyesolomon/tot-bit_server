const pool = require('../config/db');

exports.createlaboratory = (req, res) => {
    const { client_name, lab_types, client_telephone, test_result, remarks } = req.body

    if(!client_name || !lab_types || !client_telephone || !test_result || !remarks){
        return res.status(400).json({ error: 'All fields are required'});
    }

    const query = `INSERT INTO laboratory (client_name, lab_types, client_telephone, test_result, remarks) values (?, ?, ?, ?, ?)`;

    pool.query(query, [client_name, lab_types, client_telephone, test_result, remarks], (err, result) => {
        if (err) {
            console.error('Error creating client:', err);
            return res.status(500).json({ error :' Error creating laboratory'});
        }
        res.status(201).json({ message: 'Client created successfully', clientId: result.insertId });
    });
};

// Get all clients or search for clients
exports.getAllLabResults = (req, res) => {
    const { search } = req.query;
  
    // If there's a search query, filter clients by name
    let query = 'SELECT * FROM laboratory';
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
exports.getLabResultsById = (req, res) => {
    const clientId = req.params.id;
    const query = 'SELECT * FROM laboratory WHERE id = ?';
  
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
exports.updateLabResults = (req, res) => {
    const clientId = req.params.id;
    const { client_name, lab_types, client_telephone, test_result, remarks } = req.body;
  
    const query = `UPDATE laboratory SET client_name = ?, lab_types=?, client_telephone = ?, test_result = ?, remarks = ? 
                   WHERE id = ?`;
  
    pool.query(query, [client_name, lab_types, client_telephone, test_result, remarks, clientId], (err, result) => {
      if (err) {
        console.error('Error updating laboratory results:', err);
        return res.status(500).json({ error: 'Error updating laboratory results' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Laboratory Results not found' });
      }
      res.json({ message: 'Laboratory Results updated successfully' });
    });
  };

  // Delete a client by ID
exports.deleteLabResults = (req, res) => {
    const clientId = req.params.id;
    const query = 'DELETE FROM laboratory WHERE id = ?';
  
    pool.query(query, [clientId], (err, result) => {
      if (err) {
        console.error('Error deleting labarotory results:', err);
        return res.status(500).json({ error: 'Error deleting laboratory results' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Laboratory Results not found' });
      }
      res.json({ message: 'Laboratory Results deleted successfully' });
    });
  };
