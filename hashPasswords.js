const mysql = require('mysql');
const bcrypt = require('bcryptjs');

// MySQL connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'srp_rings'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.message);
        return;
    }
    console.log('Connected to MySQL Database');
});

const hashPasswords = async () => {
    try {
        // Fetch all godown owners with plaintext passwords
        db.query('SELECT id, password FROM godown_owners', async (err, results) => {
            if (err) {
                console.error('Error fetching godown owners:', err.message);
                db.end();
                return;
            }

            // Process each owner
            for (const owner of results) {
                try {
                    // Hash the plaintext password
                    const hashedPassword = await bcrypt.hash(owner.password, 10);

                    // Update the database with hashed password
                    db.query('UPDATE godown_owners SET password = ? WHERE id = ?', [hashedPassword, owner.id], (err) => {
                        if (err) {
                            console.error('Error updating password for user ID', owner.id, ':', err.message);
                        } else {
                            console.log('Password updated for user ID:', owner.id);
                        }
                    });
                } catch (err) {
                    console.error('Error hashing password for user ID', owner.id, ':', err.message);
                }
            }

            // Close the database connection
            db.end();
            console.log('Password hashing completed.');
        });
    } catch (err) {
        console.error('Error in password hashing process:', err.message);
        db.end();
    }
};

// Run the script
hashPasswords();
