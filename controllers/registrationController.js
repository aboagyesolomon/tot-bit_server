const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../config/db');

const registerUser = async (req, res) => {
  const { username, password, email, user_type, permissions } = req.body;

  try {
    if (!username || !password || !email || !user_type || !permissions || permissions.length === 0) {
      return res.status(400).json({ message: 'All fields are required, and permissions must be selected' });
    }

    const { rows: existingUsers } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (username, password, email, user_type, permissions) VALUES ($1, $2, $3, $4, $5)';
    const values = [username, hashedPassword, email, user_type, JSON.stringify(permissions)];

    await pool.query(query, values);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const generateNumericToken = () => {
  return Math.floor(100000 + Math.random() * 900000); 
};

const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const { rows: results } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (!results || results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = generateNumericToken();
    const resetTokenExpiry = Date.now() + 3600000; 

    // NOTE: PostgreSQL folds unquoted columns to lowercase. 
    // So we MUST use resetpasswordtoken and resetpasswordexpires.
    await pool.query(
      'UPDATE users SET resetpasswordtoken = $1, resetpasswordexpires = $2 WHERE email = $3',
      [resetToken, resetTokenExpiry, email]
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'solomonaboagye47@gmail.com',
        pass: 'xqcdigflgiiwnwvv', 
      },
    });

    const mailOptions = {
      from: 'Stock Management System By Emir Networking',
      to: email,
      subject: 'Password Reset Request',
      text: `Your password reset code is: ${resetToken}`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Password reset code has been sent to your email' });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;

  try {
    const { rows: results } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND resetpasswordtoken = $2 AND resetpasswordexpires > $3',
      [email, token, Date.now()]
    );

    // Check if no user was found
    if (results.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password = $1, resetpasswordtoken = NULL, resetpasswordexpires = NULL WHERE email = $2',
      [hashedPassword, email]
    );

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUsers = async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: 'Error fetching users' });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  const { id } = req.params;
  const { username, password, email, user_type, permissions } = req.body;

  try {
    const { rows: user } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    let hashedPassword = user[0].password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const query = 'UPDATE users SET username = $1, password = $2, email = $3, user_type = $4, permissions = $5 WHERE id = $6';
    const values = [
      username || user[0].username,
      hashedPassword,
      email || user[0].email,
      user_type || user[0].user_type,
      JSON.stringify(permissions || JSON.parse(user[0].permissions)),
      id
    ];

    await pool.query(query, values);
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  requestPasswordReset,
  resetPassword
};