const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const app = express();
const port = 3000;

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
    } else {
        console.log('Connected to MySQL Database');
    }
});

// Middleware to parse request body and manage sessions
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'secret-key', // Replace with a more secure secret
    resave: false,
    saveUninitialized: true
}));

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Serve HTML file for the root
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Hash password and add new godown owner
app.post('/addGodownOwner', async (req, res) => {
    const { godown_name, user_id, password } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert godown owner into the database with hashed password
        const query = 'INSERT INTO godown_owners (godown_name, user_id, password) VALUES (?, ?, ?)';
        db.query(query, [godown_name, user_id, hashedPassword], (err, result) => {
            if (err) {
                console.error('Error inserting godown owner:', err.message);
                res.status(500).send('Error adding godown owner');
            } else {
                res.send('Godown owner added successfully with hashed password');
            }
        });
    } catch (err) {
        res.status(500).send('Error processing request');
    }
});

// Godown Owner Login Form Submission
app.post('/login', (req, res) => {
    const { user_id, password } = req.body;

    const query = 'SELECT * FROM godown_owners WHERE user_id = ?';
    db.query(query, [user_id], (err, result) => {
        if (err) {
            console.error('Database query error:', err.message);
            return res.status(500).send('Database error');
        }

        if (result.length > 0) {
            const owner = result[0];

            // Compare the input password with the hashed password
            bcrypt.compare(password, owner.password, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing passwords:', err.message);
                    return res.status(500).send('Error comparing passwords');
                }

                if (isMatch) {
                    // Set session and redirect to dashboard
                    req.session.godownOwner = owner;
                    res.redirect('/godown-dashboard');
                } else {
                    res.status(401).send('Incorrect Password');
                }
            });
        } else {
            res.status(404).send('User ID not found');
        }
    });
});

// Godown Owner Dashboard (Accessible after login)
app.get('/godown-dashboard', (req, res) => {
    if (req.session.godownOwner) {
        // Fetch vendor and product data
        const queryVendors = 'SELECT * FROM Vendors';
        const queryProducts = 'SELECT * FROM Products';

        db.query(queryVendors, (err, vendors) => {
            if (err) throw err;
            db.query(queryProducts, (err, products) => {
                if (err) throw err;
                // Render the dashboard page with vendor and product data
                res.render('godown-dashboard', {
                    godownName: req.session.godownOwner.godown_name,
                    vendors: vendors,
                    products: products
                });
            });
        });
    } else {
        res.redirect('/');
    }
});

// Register a vendor
app.post('/registerVendor', (req, res) => {
    const { vendor_id, supplier_name, city, state } = req.body;

    if (!vendor_id || !supplier_name || !city || !state) {
        return res.status(400).send('All fields are required');
    }

    const query = 'INSERT INTO vendors (vendor_id, supplier_name, city, state) VALUES (?, ?, ?, ?)';
    db.query(query, [vendor_id, supplier_name, city, state], (err, result) => {
        if (err) {
            console.error('Error inserting vendor:', err.message);
            res.status(500).send('Error registering vendor');
        } else {
            res.send('Vendor registered successfully');
        }
    });
});

// Add a product
app.post('/addProduct', (req, res) => {
    const { sap_code, description, purchase_order_no, purchase_order_date, dispatched_quantity, dispatch_date, vendor_id } = req.body;

    const query = 'INSERT INTO products (sap_code, description, purchase_order_no, purchase_order_date, dispatched_quantity, dispatch_date, vendor_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [sap_code, description, purchase_order_no, purchase_order_date, dispatched_quantity, dispatch_date, vendor_id], (err, result) => {
        if (err) {
            console.error('Error inserting product:', err.message);
            res.status(500).send('Error adding product');
        } else {
            res.send('Product added successfully');
        }
    });
});

// Add an invoice
app.post('/addInvoice', (req, res) => {
    const { invoice_number, vendor_id } = req.body;

    const query = 'INSERT INTO invoices (invoice_number, vendor_id) VALUES (?, ?)';
    db.query(query, [invoice_number, vendor_id], (err, result) => {
        if (err) {
            console.error('Error inserting invoice:', err.message);
            res.status(500).send('Error adding invoice');
        } else {
            res.send('Invoice added successfully');
        }
    });
});

// Add a godown
app.post('/addGodown', (req, res) => {
    const { godown_id, godown_name, vendor_id } = req.body;

    const query = 'INSERT INTO godowns (godown_id, godown_name, vendor_id) VALUES (?, ?, ?)';
    db.query(query, [godown_id, godown_name, vendor_id], (err, result) => {
        if (err) {
            console.error('Error inserting godown:', err.message);
            res.status(500).send('Error adding godown');
        } else {
            res.send('Godown added successfully');
        }
    });
});

// Route to hash existing passwords
app.get('/hashPasswords', async (req, res) => {
    // Ensure the user has permission to access this route
    if (req.session && req.session.godownOwner && req.session.godownOwner.user_id === 'admin') { // Adjust condition as necessary
        try {
            // Fetch all godown owners with plaintext passwords
            db.query('SELECT id, password FROM godown_owners', async (err, results) => {
                if (err) {
                    console.error('Error fetching godown owners:', err.message);
                    return res.status(500).send('Error fetching godown owners');
                }

                // Check if there are any results
                if (results.length === 0) {
                    return res.send('No godown owners found.');
                }

                // Hash passwords and update them in the database
                for (const owner of results) {
                    try {
                        console.log(`Hashing password for user ID: ${owner.id}`);

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

                // Send response once all updates are done
                res.send('Passwords have been hashed and updated.');
            });
        } catch (err) {
            console.error('Error processing request:', err.message);
            res.status(500).send('Error processing request');
        }
    } else {
        res.status(403).send('Unauthorized access');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
