const pool = require('../config/db');

const calculateProfitPerUnit = ({ unit_per_quantity, unit_price, cprice }) => {
    const profitWholePack = Math.abs(unit_per_quantity * unit_price - cprice);
    return profitWholePack / unit_per_quantity;
};

exports.createTransfer = async (req, res) => {
    const {
        product_id,
        prod_name,
        cprice,
        unit_per_quantity,
        unit_price,
        quantity_to_transfer,
        profit_per_unit,
        reason
    } = req.body;

    const calculatedProfitPerUnit = profit_per_unit || calculateProfitPerUnit({ unit_per_quantity, unit_price, cprice });

    if (
        !product_id ||
        !prod_name ||
        !cprice ||
        !unit_per_quantity ||
        !unit_price ||
        !quantity_to_transfer ||
        quantity_to_transfer < 1
    ) {
        console.error('Validation error: Missing required fields or invalid quantity_to_transfer.');
        return res.status(400).json({
            error: 'You can only transfer one or more quantities (packs) at a time, and quantity must be at least 1.'
        });
    }

    const total_unit_per_quantity_transferred = quantity_to_transfer * unit_per_quantity;

    try {
        const checkQuery = `SELECT SUM(total_unit_per_quantity_transferred) AS total_units_transferred FROM transfers WHERE product_id = $1`;
        const checkResult = await pool.query(checkQuery, [product_id]);
        
        // PostgreSQL SUM returns a string or null, so we force it to a number
        const totalTransferred = Number(checkResult.rows[0]?.total_units_transferred) || 0;

        if (totalTransferred > 0 && !reason) {
            return res.status(400).json({
                error: 'Transfer is not allowed until total_unit_per_quantity_transferred reaches zero.',
                reasonRequired: true,
                message: 'Please provide a reason if you insist on transferring.',
            });
        }

        if (totalTransferred > 0 && reason) {
            const insertShortageQuery = `
                INSERT INTO shortages (product_id, prod_name, shortage_reason)
                VALUES ($1, $2, $3)
            `;
            await pool.query(insertShortageQuery, [product_id, prod_name, reason]);
        }

        const checkExistingTransferQuery = `SELECT * FROM transfers WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1`;
        const existingTransferResult = await pool.query(checkExistingTransferQuery, [product_id]);
        const existingTransfer = existingTransferResult.rows[0];

        if (existingTransfer) {
            if (reason) {
                const updateQuery = `
                    UPDATE transfers 
                    SET total_unit_per_quantity_transferred = $1, 
                        reason = $2 
                    WHERE product_id = $3
                `;
                await pool.query(updateQuery, [total_unit_per_quantity_transferred, reason, product_id]);

                return res.status(200).json({
                    message: 'Transfer record updated successfully.',
                    reasonLogged: true,
                });
            } else {
                const updatedTotalTransferred = Number(existingTransfer.total_unit_per_quantity_transferred) + total_unit_per_quantity_transferred;

                const updateQuery = `
                    UPDATE transfers 
                    SET quantity_to_transfer = $1, 
                        total_unit_per_quantity_transferred = $2,
                        reason = $3
                    WHERE product_id = $4
                `;
                await pool.query(updateQuery, [quantity_to_transfer, updatedTotalTransferred, existingTransfer.reason, product_id]);

                const updateProductQuery = `UPDATE products SET quantity = quantity - $1 WHERE id = $2`;
                await pool.query(updateProductQuery, [quantity_to_transfer, product_id]);

                return res.status(200).json({
                    message: 'Transfer record updated successfully',
                });
            }
        } else {
            const transferQuery = `
                INSERT INTO transfers (
                    product_id, 
                    prod_name, 
                    cprice, 
                    unit_per_quantity, 
                    unit_price, 
                    quantity_to_transfer,
                    profit_per_unit, 
                    total_unit_per_quantity_transferred,
                    reason
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;

            const transferResult = await pool.query(
                transferQuery,
                [product_id, prod_name, cprice, unit_per_quantity, unit_price, quantity_to_transfer, calculatedProfitPerUnit, total_unit_per_quantity_transferred, reason || null]
            );

            const updateQuery = `UPDATE products SET quantity = quantity - $1 WHERE id = $2`;
            await pool.query(updateQuery, [quantity_to_transfer, product_id]);

            return res.status(201).json({
                message: 'Transfer successful',
                transferId: transferResult.rows[0].id,
                reasonLogged: !!reason,
            });
        }
    } catch (err) {
        console.error('Error processing transfer:', err.message);
        return res.status(500).json({ error: 'Error processing transfer', details: err.message });
    }
};

exports.editTransfer = async (req, res) => {
    const { id } = req.params;
    const { quantity_to_transfer, total_unit_per_quantity_transferred, reason } = req.body;

    const updateQuery = `
        UPDATE transfers 
        SET quantity_to_transfer = $1, 
            total_unit_per_quantity_transferred = $2, 
            reason = $3
        WHERE id = $4
    `;

    try {
        await pool.query(
            updateQuery,
            [quantity_to_transfer, total_unit_per_quantity_transferred, reason, id]
        );

        res.status(200).json({
            message: 'Transfer updated successfully',
        });
    } catch (err) {
        console.error('Error updating transfer:', err.message);
        return res.status(500).json({ error: 'Error updating transfer', details: err.message });
    }
};

exports.getAllTransfer = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM transfers');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching transfers:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

exports.getAllShortages = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM shortages');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching shortages:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};