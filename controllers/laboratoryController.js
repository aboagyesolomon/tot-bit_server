const pool = require('../config/db');

exports.createlaboratory = async (req, res) => {
    const { client_name, lab_types, client_telephone, test_result, remarks } = req.body;

    if (!client_name || !lab_types || !client_telephone || !test_result || !remarks) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = `INSERT INTO laboratory (client_name, lab_types, client_telephone, test_result, remarks) VALUES ($1, $2, $3, $4, $5) RETURNING id`;

    try {
        const { rows } = await pool.query(query, [client_name, lab_types, client_telephone, test_result, remarks]);
        res.status(201).json({ message: 'Laboratory result created successfully', clientId: rows[0].id });
    } catch (err) {
        console.error('Error creating laboratory result:', err);
        return res.status(500).json({ error: 'Error creating laboratory result' });
    }
};

// Get all lab results or search by client name
exports.getAllLabResults = async (req, res) => {
    const { search } = req.query;

    let query = 'SELECT * FROM laboratory';
    let queryParams = [];

    if (search) {
        query += ' WHERE client_name ILIKE $1'; // ILIKE is case-insensitive in PostgreSQL
        queryParams.push(`%${search}%`);
    }

    try {
        const { rows } = await pool.query(query, queryParams);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching laboratory results:', err);
        return res.status(500).json({ error: 'Error fetching laboratory results' });
    }
};

// Get a single lab result by ID
exports.getLabResultsById = async (req, res) => {
    const clientId = req.params.id;
    const query = 'SELECT * FROM laboratory WHERE id = $1';

    try {
        const { rows } = await pool.query(query, [clientId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Laboratory result not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching laboratory result:', err);
        return res.status(500).json({ error: 'Error fetching laboratory result' });
    }
};

// Update lab result information
exports.updateLabResults = async (req, res) => {
    const clientId = req.params.id;
    const { client_name, lab_types, client_telephone, test_result, remarks } = req.body;

    const query = `UPDATE laboratory SET client_name = $1, lab_types = $2, client_telephone = $3, test_result = $4, remarks = $5 
                   WHERE id = $6`;

    try {
        const result = await pool.query(query, [client_name, lab_types, client_telephone, test_result, remarks, clientId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Laboratory result not found' });
        }
        res.json({ message: 'Laboratory result updated successfully' });
    } catch (err) {
        console.error('Error updating laboratory results:', err);
        return res.status(500).json({ error: 'Error updating laboratory results' });
    }
};

// Delete a lab result by ID
exports.deleteLabResults = async (req, res) => {
    const clientId = req.params.id;
    const query = 'DELETE FROM laboratory WHERE id = $1';

    try {
        const result = await pool.query(query, [clientId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Laboratory result not found' });
        }
        res.json({ message: 'Laboratory result deleted successfully' });
    } catch (err) {
        console.error('Error deleting laboratory results:', err);
        return res.status(500).json({ error: 'Error deleting laboratory results' });
    }
};