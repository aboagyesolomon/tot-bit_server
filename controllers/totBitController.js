const pool = require('../config/db');

exports.createTotBit = (req, res) => {
    console.log('Received request data:', req.body);
    
    const { transfers } = req.body;
    if (!transfers || transfers.length === 0) {
        console.error('No transfer data provided.');
        return res.status(400).json({ error: 'No transfer data provided.' });
    }

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection from pool:', err.message);
            return res.status(500).json({ error: 'Error getting database connection' });
        }

        connection.beginTransaction(async (transactionErr) => {
            if (transactionErr) {
                console.error('Error starting transaction:', transactionErr.message);
                connection.release();
                return res.status(500).json({ error: 'Error starting transaction' });
            }

            try {
                const saleResults = [];

                for (const transfer of transfers) {
                    const { transfer_id, quantity_sold, amount_paid } = transfer;

                    if (!transfer_id || !quantity_sold || quantity_sold < 1 || !amount_paid || amount_paid < 0) {
                        throw new Error('Invalid input. Ensure all fields are provided and valid.');
                    }

                    console.log('Fetching transfer details for transfer_id:', transfer_id);
                    const transferQuery = `SELECT id, prod_name, unit_price, unit_per_quantity, cprice, total_unit_per_quantity_transferred, profit_per_unit FROM transfers WHERE id = ?`;
                    const transferResult = await queryAsync(connection, transferQuery, [transfer_id]);

                    if (!transferResult || transferResult.length === 0) {
                        throw new Error(`Transfer not found for ID: ${transfer_id}`);
                    }

                    const { prod_name, unit_price, cprice, unit_per_quantity, total_unit_per_quantity_transferred, profit_per_unit } = transferResult[0];
                    console.log('Fetched transfer details:', { prod_name, unit_price, unit_per_quantity, cprice, total_unit_per_quantity_transferred, profit_per_unit });

                    const total_amount = unit_price * quantity_sold;
                    const change_given = amount_paid - total_amount;

                    if (change_given < 0) {
                        throw new Error('Insufficient amount paid. Change cannot be negative.');
                    }

                    const total_profit = profit_per_unit * quantity_sold;

                    const updated_unit_per_quantity_transferred = total_unit_per_quantity_transferred - quantity_sold;
                    if (updated_unit_per_quantity_transferred < 0) {
                        throw new Error(`Insufficient stock available for transfer ID: ${transfer_id}`);
                    }

                    const updateQuery = `UPDATE transfers SET total_unit_per_quantity_transferred = ? WHERE id = ?`;
                    await queryAsync(connection, updateQuery, [updated_unit_per_quantity_transferred, transfer_id]);
                    console.log(`Updated total_unit_per_quantity_transferred for transfer_id ${transfer_id}: ${updated_unit_per_quantity_transferred}`);

                    const saleQuery = `
                        INSERT INTO totBit (transfer_id, prod_name, quantity_sold, total_amount, amount_paid, change_given, profit, remaining_stock)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    const saleResult = await queryAsync(connection, saleQuery, [
                        transfer_id,
                        prod_name,
                        quantity_sold,
                        total_amount,
                        amount_paid,
                        change_given,
                        total_profit,
                        updated_unit_per_quantity_transferred,
                    ]);

                    console.log('Sale record created with ID:', saleResult.insertId);
                    saleResults.push({ saleId: saleResult.insertId, transfer_id, updatedStock: updated_unit_per_quantity_transferred });
                }

                await connection.commit();
                res.status(201).json({
                    message: 'All transfers processed successfully',
                    sales: saleResults,
                });
            } catch (error) {
                console.error('Error processing transfers:', error.message);
                await connection.rollback();
                res.status(500).json({ error: 'Error processing transfers', details: error.message });
            } finally {
                connection.release();
            }
        });
    });
};

function queryAsync(connection, sql, params) {
    return new Promise((resolve, reject) => {
        connection.query(sql, params, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}

exports.getAllTotBit = (req, res) => {
    pool.query('SELECT * FROM totBit', (error, totBits) => {
        if (error) {
            console.error('Error fetching TotBits:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        const total_profit = totBits.reduce((acc, sale) => acc + parseFloat(sale.profit), 0).toFixed(2);

        res.json({
            totBits,
            total_profit,
        });
    });
};
