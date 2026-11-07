const pool = require('../config/db');

const calculateProfitPerUnit = ({ unit_per_quantity, unit_price, cprice }) => {
    const profitWholePack = Math.abs(unit_per_quantity * unit_price - cprice);
    return profitWholePack / unit_per_quantity;
};

exports.createTransfer = (req, res) => {
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

    console.log('Received transfer data:', req.body);

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

    const checkQuery = `SELECT SUM(total_unit_per_quantity_transferred) AS total_units_transferred FROM transfers WHERE product_id = ?`;

    pool.query(checkQuery, [product_id], (checkErr, result) => {
        if (checkErr) {
            console.error('Error checking transfer data:', checkErr.message);
            return res.status(500).json({ error: 'Error checking transfer data', details: checkErr.message });
        }

        const totalTransferred = result[0]?.total_units_transferred || 0;

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
                VALUES (?, ?, ?)
            `;
            pool.query(insertShortageQuery, [product_id, prod_name, reason], (shortageErr) => {
                if (shortageErr) {
                    console.error('Error logging shortage:', shortageErr.message);
                    return res.status(500).json({ error: 'Error logging shortage', details: shortageErr.message });
                }
                console.log('Shortage logged successfully.');
            });
        }

        const checkExistingTransferQuery = `SELECT * FROM transfers WHERE product_id = ? ORDER BY created_at DESC LIMIT 1`;

        pool.query(checkExistingTransferQuery, [product_id], (checkExistingErr, existingTransferResult) => {
            if (checkExistingErr) {
                console.error('Error checking existing transfer:', checkExistingErr.message);
                return res.status(500).json({ error: 'Error checking existing transfer', details: checkExistingErr.message });
            }

            const existingTransfer = existingTransferResult[0];

            if (existingTransfer) {
                if (reason) {
                    const updateQuery = `
                        UPDATE transfers 
                        SET total_unit_per_quantity_transferred = ?, 
                            reason = ? 
                        WHERE product_id = ?
                    `;

                    pool.query(updateQuery, [total_unit_per_quantity_transferred, reason, product_id], (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating transfer record:', updateErr.message);
                            return res.status(500).json({ error: 'Error updating transfer record', details: updateErr.message });
                        }

                        console.log('Transfer record updated with new total_unit_per_quantity_transferred due to reason.');
                        return res.status(200).json({
                            message: 'Transfer record updated successfully.',
                            reasonLogged: true,
                        });
                    });
                } else {
                    const updatedTotalTransferred = existingTransfer.total_unit_per_quantity_transferred + total_unit_per_quantity_transferred;

                    const updateQuery = `
                        UPDATE transfers 
                        SET quantity_to_transfer = ?, 
                            total_unit_per_quantity_transferred = ?,
                            reason = ?
                        WHERE product_id = ?
                    `;

                    pool.query(updateQuery, [quantity_to_transfer, updatedTotalTransferred, existingTransfer.reason, product_id], (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating transfer record:', updateErr.message);
                            return res.status(500).json({ error: 'Error updating transfer record', details: updateErr.message });
                        }

                        const updateProductQuery = `UPDATE products SET quantity = quantity - ? WHERE id = ?`;
                        pool.query(updateProductQuery, [quantity_to_transfer, product_id], (updateProdErr) => {
                            if (updateProdErr) {
                                console.error('Error updating product quantity:', updateProdErr.message);
                                return res.status(500).json({ error: 'Error updating product quantity', details: updateProdErr.message });
                            }

                            res.status(200).json({
                                message: 'Transfer record updated successfully',
                            });
                        });
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
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                pool.query(
                    transferQuery,
                    [product_id, prod_name, cprice, unit_per_quantity, unit_price, quantity_to_transfer, calculatedProfitPerUnit, total_unit_per_quantity_transferred, reason || null],
                    (transferErr, result) => {
                        if (transferErr) {
                            console.error('Error creating transfer record:', transferErr.message);
                            return res.status(500).json({ error: 'Error creating transfer record', details: transferErr.message });
                        }

                        const updateQuery = `UPDATE products SET quantity = quantity - ? WHERE id = ?`;
                        pool.query(updateQuery, [quantity_to_transfer, product_id], (updateErr) => {
                            if (updateErr) {
                                console.error('Error updating product quantity:', updateErr.message);
                                return res.status(500).json({ error: 'Error updating product quantity', details: updateErr.message });
                            }

                            res.status(201).json({
                                message: 'Transfer successful',
                                transferId: result.insertId,
                                reasonLogged: !!reason,
                            });
                        });
                    }
                );
            }
        });
    });
};

exports.editTransfer = (req, res) => {
    const { id } = req.params;
    const { quantity_to_transfer, total_unit_per_quantity_transferred, reason } = req.body;

    const updateQuery = `
        UPDATE transfers 
        SET quantity_to_transfer = ?, 
            total_unit_per_quantity_transferred = ?, 
            reason = ?
        WHERE id = ?
    `;

    pool.query(
        updateQuery,
        [quantity_to_transfer, total_unit_per_quantity_transferred, reason, id],
        (err, result) => {
            if (err) {
                console.error('Error updating transfer:', err.message);
                return res.status(500).json({ error: 'Error updating transfer', details: err.message });
            }

            res.status(200).json({
                message: 'Transfer updated successfully',
            });
        }
    );
};

exports.getAllTransfer = (req, res) => {
    pool.query('SELECT * FROM transfers', (error, transfers) => {
        if (error) {
            console.error('Error fetching transfers:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json(transfers);
    });
};

exports.getAllShortages = (req, res) => {
    pool.query('SELECT * FROM shortages', (error, shortages) => {
        if (error) {
            console.error('Error fetching shortages:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.json(shortages);
    });
};
