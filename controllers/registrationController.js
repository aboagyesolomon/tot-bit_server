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

    pool.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      if (results.length > 0) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const query = 'INSERT INTO users (username, password, email, user_type, permissions) VALUES (?, ?, ?, ?, ?)';
      const values = [username, hashedPassword, email, user_type, JSON.stringify(permissions)];

      pool.query(query, values, (err, result) => {
        if (err) {
          console.error('Error inserting user:', err);
          return res.status(500).json({ message: 'Server error' });
        }

        res.status(201).json({ message: 'User registered successfully' });
      });
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const generateNumericToken = () => {
  return Math.floor(100000 + Math.random() * 900000); 
};

const queryPromise = (query, values = []) => {
  return new Promise((resolve, reject) => {
    pool.query(query, values, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
};

const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const results = await queryPromise('SELECT * FROM users WHERE email = ?', [email]);

    if (!results || results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = results[0]; 

    const resetToken = generateNumericToken();
    const resetTokenExpiry = Date.now() + 3600000; 

    await queryPromise(
      'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?',
      [resetToken, resetTokenExpiry, email]
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'solomonaboagye47@gmail.com',
        pass: 'ajjgdduoiabgessi', 
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
    pool.query(
      'SELECT * FROM users WHERE email = ? AND resetPasswordToken = ? AND resetPasswordExpires > ?',
      [email, token, Date.now()],
      async (error, results) => {
        if (error) {
          console.error('Database error:', error);
          return res.status(500).json({ message: 'Server error' });
        }

        // Check if no user was found
        if (results.length === 0) {
          return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        pool.query(
          'UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?',
          [hashedPassword, email],
          (updateError) => {
            if (updateError) {
              console.error('Error updating password:', updateError);
              return res.status(500).json({ message: 'Server error' });
            }
            res.json({ message: 'Password has been reset successfully' });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


const getUsers = (req, res) => {
  pool.query('SELECT * FROM users', (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ error: 'Error fetching users' });
    }

    res.json(results);
  });
};

const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
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
    const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    let hashedPassword = user[0].password;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const query = 'UPDATE users SET username = ?, password = ?, email = ?, user_type = ?, permissions = ? WHERE id = ?';
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
    pool.query('DELETE FROM users WHERE id = ?', [id], (err, result) => {
      if (err) {
        console.error('Error deleting user:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    });
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
