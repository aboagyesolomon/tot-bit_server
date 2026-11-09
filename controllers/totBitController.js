const pool = require('../config/db');

exports.createTotBit = async (req, res) => {
    console.log('Received request data:', req.body);
    
    const { transfers } = req.body;
    if (!transfers || transfers.length === 0) {
        console.error('No transfer data provided.');
        return res.status(400).json({ error: 'No transfer data provided.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const saleResults = [];

        for (const transfer of transfers) {
            const { transfer_id, quantity_sold, amount_paid } = transfer;

            if (!transfer_id || !quantity_sold || quantity_sold < 1 || !amount_paid || amount_paid < 0) {
                throw new Error('Invalid input. Ensure all fields are provided and valid.');
            }

            console.log('Fetching transfer details for transfer_id:', transfer_id);
            const transferQuery = `SELECT id, prod_name, unit_price, unit_per_quantity, cprice, total_unit_per_quantity_transferred, profit_per_unit FROM transfers WHERE id = $1`;
            const transferResult = await client.query(transferQuery, [transfer_id]);

            if (!transferResult.rows || transferResult.rows.length === 0) {
                throw new Error(`Transfer not found for ID: ${transfer_id}`);
            }

            const { prod_name, unit_price, cprice, unit_per_quantity, total_unit_per_quantity_transferred, profit_per_unit } = transferResult.rows[0];
            
            const total_amount = Number(unit_price) * quantity_sold;
            const change_given = Number(amount_paid) - total_amount;

            if (change_given < 0) {
                throw new Error('Insufficient amount paid. Change cannot be negative.');
            }

            const total_profit = Number(profit_per_unit) * quantity_sold;

            const updated_unit_per_quantity_transferred = Number(total_unit_per_quantity_transferred) - quantity_sold;
            if (updated_unit_per_quantity_transferred < 0) {
                throw new Error(`Insufficient stock available for transfer ID: ${transfer_id}`);
            }

            const updateQuery = `UPDATE transfers SET total_unit_per_quantity_transferred = $1 WHERE id = $2`;
            await client.query(updateQuery, [updated_unit_per_quantity_transferred, transfer_id]);

            const saleQuery = `
                INSERT INTO totbit (transfer_id, prod_name, quantity_sold, total_amount, amount_paid, change_given, profit, remaining_stock)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
            `;
            const saleResult = await client.query(saleQuery, [
                transfer_id,
                prod_name,
                quantity_sold,
                total_amount,
                amount_paid,
                change_given,
                total_profit,
                updated_unit_per_quantity_transferred,
            ]);

            saleResults.push({ 
                saleId: saleResult.rows[0].id, 
                transfer_id, 
                updatedStock: updated_unit_per_quantity_transferred 
            });
        }

        await client.query('COMMIT');
        res.status(201).json({
            message: 'All transfers processed successfully',
            sales: saleResults,
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing transfers:', error.message);
        res.status(500).json({ error: 'Error processing transfers', details: error.message });
    } finally {
        client.release();
    }
};

exports.getAllTotBit = async (req, res) => {
    try {
        const { rows: totBits } = await pool.query('SELECT * FROM totbit');
        
        const total_profit = totBits.reduce((acc, sale) => acc + parseFloat(sale.profit), 0).toFixed(2);

        res.json({
            totBits,
            total_profit,
        });
    } catch (error) {
        console.error('Error fetching TotBits:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};