const pool = require('../config/db');

exports.createSale = (req, res) => {
  const { selectedProducts, paymentMode, amountPaid, username, clientName, clientPhone, serialNumber } = req.body;

  console.log('Request received:', req.body);  

  pool.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection from pool:', err);
      return res.status(500).send('Error getting database connection');
    };

    connection.beginTransaction(async (transactionErr) => {
      if (transactionErr) {
        console.error('Error starting transaction:', transactionErr);
        connection.release();
        return res.status(500).send('Error starting transaction');
      }

      try {
        const getUserQuery = 'SELECT id FROM users WHERE username = ?';
        const userResult = await queryAsync(connection, getUserQuery, [username]);

        if (!userResult || userResult.length === 0) {
          throw new Error(`User with username ${username} not found`);
        }

        const { id: user_id } = userResult[0]; 

        await Promise.all(
          selectedProducts.map(async (product) => {
            const { product_id, quantity } = product;

            const getProductQuery = 'SELECT prod_name, sprice, cprice, quantity FROM products WHERE id = ?';
            const productResult = await queryAsync(connection, getProductQuery, [product_id]);

            if (!productResult || productResult.length === 0) {
              throw new Error(`Product with id ${product_id} not found`);
            }

            const { prod_name, sprice, cprice, quantity: availableQuantity } = productResult[0];

            if (availableQuantity < quantity) {
              throw new Error(`Insufficient stock for product: ${prod_name}`);
            }

            const total_amount = sprice * quantity;
            const profit = (sprice - cprice) * quantity; // Calculate profit

            const updateProductQuery = 'UPDATE products SET quantity = quantity - ? WHERE id = ?';
            await queryAsync(connection, updateProductQuery, [quantity, product_id]);

            if (paymentMode !== 'credit') {
              const insertSaleQuery = `
                INSERT INTO sales (product_id, prod_name, quantity_sold, total_amount, amount_paid, change_given, payment_mode, user_id, username, profit, serialNumber)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;
              await queryAsync(connection, insertSaleQuery, [
                product_id,
                prod_name,
                quantity,
                total_amount,
                amountPaid,
                amountPaid - total_amount,
                paymentMode,
                user_id,
                username,
                profit,
                serialNumber
              ]);
            }
          })
        );

        if (paymentMode === 'credit') {
          const productPrices = await Promise.all(
            selectedProducts.map(async (product) => {
              const { product_id, quantity } = product;

              const getProductQuery = 'SELECT sprice, cprice FROM products WHERE id = ?';
              const productResult = await queryAsync(connection, getProductQuery, [product_id]);

              if (!productResult || productResult.length === 0) {
                throw new Error(`Product with id ${product_id} not found`);
              }

              return { price: productResult[0].sprice, cprice: productResult[0].cprice, quantity }; // Return price, cprice, and quantity for total amount calculation
            })
          );

          const totalAmount = productPrices.reduce((sum, { price, quantity }) => {
            return sum + (price * quantity);
          }, 0);

          const balance = totalAmount - amountPaid;

          const productsJson = JSON.stringify(selectedProducts.map(product => ({
            product_id: product.product_id,
            quantity: product.quantity,
            prod_name: product.prod_name, 
          })));

          const insertCreditSaleQuery = `
            INSERT INTO credit_sales (client_name, client_phone, total_amount, amount_paid, balance, products)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          await queryAsync(connection, insertCreditSaleQuery, [
            clientName,
            clientPhone,
            totalAmount,
            amountPaid,
            balance,
            productsJson,
          ]);
        }

        await connection.commit();
        console.log('Sale completed successfully');
        res.json({ message: 'Sale completed successfully' });

      } catch (error) {
        console.error('Error processing sale:', error);
        await connection.rollback();
        res.status(500).send(error.message);
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
};


// exports.getAllSales = (req, res) => {
//   const query = `SELECT * FROM sales;`;

//   pool.query(query, (error, sales) => {
//     if (error) {
//       console.error('Error fetching sales:', error);
//       return res.status(500).json({ error: 'Internal Server Error' });
//     }
//     res.json(sales);
//   });
// };

exports.getAllSales = (req, res) => {
  const query = `
    SELECT 
      sales.*,
      sale_id AS saleId
    FROM sales
    ORDER BY sale_date DESC;
  `;

  pool.query(query, (error, sales) => {
    if (error) {
      console.error('Error fetching sales:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.json(sales);
  });
};

exports.getSaleById = (req, res) => {
  const { id } = req.params;
  pool.query('SELECT * FROM sales WHERE id = ?', [id], (error, sales) => {
    if (error) {
      console.error('Error fetching sale by ID:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (sales.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    res.json(sales[0]);
  });
}

exports.getAllCreditSales = (req, res) => {
  const query = `SELECT * FROM credit_sales;`;

  pool.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching credit sales:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    res.json(results);
  });
};

exports.getCreditSaleById = (req, res) => {
  const { id } = req.params;

  pool.query('SELECT * FROM credit_sales WHERE id = ?', [id], (error, results) => {
    if (error) {
      console.error('Error fetching credit sale by ID:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Credit sale not found' });
    }
    res.json(results[0]);
  });
}

exports.updateCreditSale = (req, res) => {
  const { id } = req.params;
  const { client_name, client_phone, total_amount, amount_paid, products } = req.body;

  const balance = parseFloat(total_amount) - parseFloat(amount_paid);

  const updateQuery = `
    UPDATE credit_sales 
    SET client_name = ?, client_phone = ?, total_amount = ?, amount_paid = ?, balance = ?, products = ?
    WHERE id = ?;
  `;

  pool.query(
    updateQuery,
    [client_name, client_phone, total_amount, amount_paid, balance, JSON.stringify(products), id],
    (error, results) => {
      if (error) {
        console.error('Error updating credit sale:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: 'Credit sale not found' });
      }
      res.json({ message: 'Credit sale updated successfully', balance });
    }
  );
};


exports.deleteCreditSale = (req, res) => {
  const { id } = req.params;

  const deleteQuery = 'DELETE FROM credit_sales WHERE id = ?';

  pool.query(deleteQuery, [id], (error, results) => {
    if (error) {
      console.error('Error deleting credit sale:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Credit sale not found' });
    }
    res.json({ message: 'Credit sale deleted successfully' });
  });
};

// exports.updateSaleAfterReturn = async (req, res) => {
//   const { saleId, newQuantity } = req.body;

//   pool.getConnection((err, connection) => {
//     if (err) return res.status(500).send('DB connection error');

//     connection.beginTransaction(async (err) => {
//       if (err) {
//         connection.release();
//         return res.status(500).send('Transaction error');
//       }

//       try {
//         // 1. Get original sale
//         const saleResult = await queryAsync(
//           connection,
//           'SELECT * FROM sales WHERE id = ?',
//           [saleId]
//         );

//         if (!saleResult.length) {
//           throw new Error('Sale not found');
//         }

//         const sale = saleResult[0];

//         const oldQty = sale.quantity_sold;
//         const qtyDiff = oldQty - newQuantity;

//         if (qtyDiff < 0) {
//           throw new Error('Cannot increase quantity beyond original sale');
//         }

//         // 2. Get product cost info
//         const productResult = await queryAsync(
//           connection,
//           'SELECT cprice FROM products WHERE id = ?',
//           [sale.product_id]
//         );

//         const cprice = productResult[0].cprice;

//         const oldTotal = sale.total_amount;
//         const unitPrice = oldTotal / oldQty;

//         const newTotal = unitPrice * newQuantity;
//         const newProfit = (unitPrice - cprice) * newQuantity;

//         // 3. Update sale row
//         await queryAsync(
//           connection,
//           `UPDATE sales 
//            SET quantity_sold = ?, total_amount = ?, profit = ?
//            WHERE id = ?`,
//           [newQuantity, newTotal, newProfit, saleId]
//         );

//         // 4. Restore stock difference
//         if (qtyDiff > 0) {
//           await queryAsync(
//             connection,
//             'UPDATE products SET quantity = quantity + ? WHERE id = ?',
//             [qtyDiff, sale.product_id]
//           );
//         }

//         await connection.commit();
//         res.json({ message: 'Sale updated successfully' });

//       } catch (error) {
//         await connection.rollback();
//         res.status(500).json({ error: error.message });
//       } finally {
//         connection.release();
//       }
//     });
//   });
// };

//Update sale after return
exports.updateSaleAfterReturn = async (req, res) => {
  const { saleId, newQuantity } = req.body;

  const parsedSaleId = Number(saleId);
  const parsedQuantity = Number(newQuantity);

  if (!Number.isInteger(parsedSaleId) || parsedSaleId <= 0) {
    return res.status(400).json({
      error: 'Invalid sale ID',
      received: req.body,
    });
  }

  if (Number.isNaN(parsedQuantity) || parsedQuantity < 0) {
    return res.status(400).json({
      error: 'Invalid quantity',
      received: req.body,
    });
  }

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send('DB connection error');

    connection.beginTransaction(async (err) => {
      if (err) {
        connection.release();
        return res.status(500).send('Transaction error');
      }

      try {
        const saleResult = await queryAsync(
          connection,
          'SELECT * FROM sales WHERE sale_id = ?',
          [parsedSaleId]
        );

        if (!saleResult.length) {
          throw new Error('Sale not found');
        }

        const sale = saleResult[0];

        const oldQty = Number(sale.quantity_sold);
        const qtyDiff = oldQty - parsedQuantity;

        // if (qtyDiff < 0) {
        //   throw new Error('Cannot increase quantity beyond original sale');
        // }

        if (qtyDiff > 0) {
          await queryAsync(
            connection,
            'UPDATE products SET quantity = quantity + ? WHERE id = ?',
            [qtyDiff, sale.product_id]
          );
        }

        if (parsedQuantity === 0) {
          await queryAsync(
            connection,
            'DELETE FROM sales WHERE sale_id = ?',
            [parsedSaleId]
          );

          await connection.commit();

          return res.json({
            message: 'Sale item removed successfully',
          });
        }

        const productResult = await queryAsync(
          connection,
          'SELECT cprice FROM products WHERE id = ?',
          [sale.product_id]
        );

        if (!productResult.length) {
          throw new Error('Product not found');
        }

        const cprice = Number(productResult[0].cprice);
        const oldTotal = Number(sale.total_amount);
        const unitPrice = oldTotal / oldQty;

        const newTotal = unitPrice * parsedQuantity;
        const newProfit = (unitPrice - cprice) * parsedQuantity;

        await queryAsync(
          connection,
          `
            UPDATE sales 
            SET quantity_sold = ?, total_amount = ?, profit = ?
            WHERE sale_id = ?
          `,
          [parsedQuantity, newTotal, newProfit, parsedSaleId]
        );

        await connection.commit();

        res.json({
          message: 'Sale updated successfully',
        });

      } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
      } finally {
        connection.release();
      }
    });
  });
};

//add product to existing sales
exports.addProductToExistingReceipt = async (req, res) => {
  const {
    serialNumber,
    productId,
    product_id,
    quantity,
    paymentMode,
    username,
    amountPaid
  } = req.body;

  const parsedProductId = Number(productId || product_id);
  const parsedQuantity = Number(quantity);

  if (!serialNumber) {
    return res.status(400).json({ error: 'Serial number is required' });
  }

  if (!Number.isInteger(parsedProductId) || parsedProductId <= 0) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }

  pool.getConnection((err, connection) => {
    if (err) return res.status(500).send('DB connection error');

    connection.beginTransaction(async (err) => {
      if (err) {
        connection.release();
        return res.status(500).send('Transaction error');
      }

      try {
        const originalSaleResult = await queryAsync(
          connection,
          `
            SELECT user_id, username, payment_mode
            FROM sales
            WHERE serialNumber = ?
            LIMIT 1
          `,
          [serialNumber]
        );

        if (!originalSaleResult.length) {
          throw new Error('Original receipt not found');
        }

        const originalSale = originalSaleResult[0];

        let finalUsername = username || originalSale.username;
        let finalUserId = originalSale.user_id;
        const finalPaymentMode = paymentMode || originalSale.payment_mode;

        if (finalUsername) {
          const userResult = await queryAsync(
            connection,
            'SELECT id FROM users WHERE username = ?',
            [finalUsername]
          );

          if (userResult.length) {
            finalUserId = userResult[0].id;
          }
        }

        const productResult = await queryAsync(
          connection,
          `
            SELECT prod_name, sprice, cprice, quantity
            FROM products
            WHERE id = ?
          `,
          [parsedProductId]
        );

        if (!productResult.length) {
          throw new Error('Product not found');
        }

        const product = productResult[0];

        if (Number(product.quantity) < parsedQuantity) {
          throw new Error(`Insufficient stock for product: ${product.prod_name}`);
        }

        const sprice = Number(product.sprice);
        const cprice = Number(product.cprice);

        const totalAmount = sprice * parsedQuantity;
        const profit = (sprice - cprice) * parsedQuantity;

        const paidAmount =
          amountPaid !== undefined && amountPaid !== null
            ? Number(amountPaid)
            : totalAmount;

        if (Number.isNaN(paidAmount) || paidAmount < 0) {
          throw new Error('Invalid amount paid');
        }

        await queryAsync(
          connection,
          'UPDATE products SET quantity = quantity - ? WHERE id = ?',
          [parsedQuantity, parsedProductId]
        );

        await queryAsync(
          connection,
          `
            INSERT INTO sales 
            (
              product_id,
              prod_name,
              quantity_sold,
              total_amount,
              amount_paid,
              change_given,
              payment_mode,
              user_id,
              username,
              profit,
              serialNumber
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            parsedProductId,
            product.prod_name,
            parsedQuantity,
            totalAmount,
            paidAmount,
            paidAmount - totalAmount,
            finalPaymentMode,
            finalUserId,
            finalUsername,
            profit,
            serialNumber
          ]
        );

        await connection.commit();

        res.json({
          message: 'Product added to receipt successfully',
        });

      } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
      } finally {
        connection.release();
      }
    });
  });
};

exports.getDailySalesTotals = (req, res) => {
  const query = `
    SELECT 
      DATE(sale_date) AS sale_date,
      SUM(total_amount) AS total_sales,
      SUM(profit) AS total_profit,
      COUNT(*) AS total_items
    FROM sales
    WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY DATE(sale_date)
    ORDER BY sale_date DESC;
  `;

  pool.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching daily sales totals:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.json(results);
  });
};