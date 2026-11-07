const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const axios = require("axios");
require("dotenv").config()


exports.loginUser = (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ msg: 'Please provide username and password' });
    }

    const findUserQuery = 'SELECT * FROM users WHERE username = ?';
    pool.query(findUserQuery, [username], (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ msg: 'Server error', error: err.message });
        }

        if (results.length === 0) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const user = results[0];

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, permissions: user.permissions, user_type: user.user_type }, 
            '0243818668',
            { expiresIn: '7d' }
        );

        const expirationTime = jwt.decode(token).exp * 1000; 

        const updateLoginTimeQuery = 'UPDATE users SET login_time = NOW() WHERE id = ?';
        pool.query(updateLoginTimeQuery, [user.id], (updateErr) => {
            if (updateErr) {
                console.error('Error updating login time:', updateErr);
                return res.status(500).json({ msg: 'Error updating login time' });
            }

            res.json({
                token,
                permissions: user.permissions,
                username: user.username,
                user_type: user.user_type,
                expiresIn: expirationTime,
                email: user.email
            });
        });
    });
};

exports.logoutUser = (req, res) => {
    const userId = req.user?.id; 
    const username = req.body.username; 

    if (!userId && !username) {
        return res.status(400).json({ msg: 'User ID or username is required to log out' });
    }

    const userQuery = userId ? `SELECT * FROM users WHERE id = ?` : `SELECT * FROM users WHERE username = ?`;
    const userValue = userId ? [userId] : [username];

    pool.query(userQuery, userValue, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ msg: 'Server error', error: err.message });
        }

        if (results.length === 0) {
            return res.status(400).json({ msg: 'User not found' });
        }

        const updateLogoutTimeQuery = 'UPDATE users SET logout_time = NOW() WHERE id = ?';
        pool.query(updateLogoutTimeQuery, [results[0].id], (updateErr) => {
            if (updateErr) {
                console.error('Error updating logout time:', updateErr);
                return res.status(500).json({ msg: 'Error updating logout time' });
            }

            res.status(200).json({ msg: 'Logout successful' });
        });
    });
};



exports.createPayment = async (req, res) => {
  const { phone, amount } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ error: "Phone and amount are required" });
  }

  // Generate a dummy email from phone number
  const dummyEmail = `${phone.replace(/\D/g, "")}@yourapp.com`;

  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: dummyEmail,
        amount: amount * 100,
        currency: "GHS",
        channels: ["mobile_money"],
        metadata: {
          phone,
        },
        callback_url: "http://localhost:3000/payment-success", // optional
      },
      {
        headers: {
          Authorization: `Bearer sk_test_70d80a0b20cfc26b76c89d4f9bfca1e4fe3ffea7`, // ✅ FIXED
          "Content-Type": "application/json",
        }
        
      }
    );

    const { authorization_url, reference } = response.data.data;

    res.status(200).json({ message: "Payment link created", paymentUrl: authorization_url, reference });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
};


