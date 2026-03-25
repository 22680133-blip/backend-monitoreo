const pool = require('../config/db');

const User = {

  async findOneByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  },

  async create({ email, name, picture, googleId, facebookId }) {
    const result = await pool.query(
      `INSERT INTO users (email, name, picture, google_id, facebook_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [email, name, picture, googleId, facebookId]
    );
    return result.rows[0];
  }

};

module.exports = User;