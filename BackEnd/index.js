// Modules Import
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// JWT secret key
const JWT_SECRET = "ftpi_q825hnWESA_1s83Q";

// Express initialization
const app = express();
app.use(express.json());

// Database connection
const db = new sqlite3.Database("./reservations.db", (err) => {
    if (err) {
        console.error("Error after trying to connect with SQLite:", err.message);
    } else {
        console.log("Successfully connected to SQLite.");
    }
});

// Database initialization
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            service_id INTEGER,
            date TEXT,
            status TEXT,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (service_id) REFERENCES services(id)
        )
    `);

    console.log("Tables created successfully.");
});

// Middleware para verificar el token JWT
function verifyToken(req, res, next) {
    const token = req.headers["authorization"];

    if (!token) {
        return res.status(401).json({ error: "Denied Access" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Invalid Token" });
        }
        req.user = decoded;
        next();
    });
}

// Endpoint base
app.get("/", (req, res) => {
    res.send("Reservation System API");
});

// Create a new reservation
app.post("/reservations", verifyToken, (req, res) => {
    const { client_id, service_id, date, status } = req.body;
    const sql = `
      INSERT INTO reservations (client_id, service_id, date, status)
      VALUES (?, ?, ?, ?)
    `;
    db.run(sql, [client_id, service_id, date, status], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID });
    });
});

// Retrieve every reservation
app.get("/reservations", verifyToken, (req, res) => {
    const sql = `
      SELECT reservations.id, clients.name AS client, services.name AS service, date, status
      FROM reservations
      JOIN clients ON reservations.client_id = clients.id
      JOIN services ON reservations.service_id = services.id
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ reservations: rows });
    });
});

// Modify an existing reservation
app.put("/reservations/:id", verifyToken, (req, res) => {
    const { client_id, service_id, date, status } = req.body;
    const { id } = req.params;
    const sql = `
      UPDATE reservations
      SET client_id = ?, service_id = ?, date = ?, status = ?
      WHERE id = ?
    `;
    db.run(sql, [client_id, service_id, date, status, id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Reservation successfully updated." });
    });
});

// Delete a reservation
app.delete("/reservations/:id", verifyToken, (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM reservations WHERE id = ?`;
    db.run(sql, id, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Reservation successfully deleted" });
    });
});

// Register a new client
app.post("/client", async (req, res) => {

    const { name, email, password } = req.body;

    // Validate that a client with the same email doesn't exist yet
    const userExists = db.get(`SELECT * FROM clients WHERE email = ?`, [email]);
    if (userExists) {
        return res.status(400).json({ error: "The client is already registered" });
    }

    // Encrypt password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new client into the database
    db.run(
        `INSERT INTO clients (name, email, password) VALUES (?, ?, ?)`,
        [name, email, hashedPassword],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: "User registered successfully" });
        }
    );
});

// Client login
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM clients WHERE email = ?`, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!user) {
            return res.status(400).json({ error: "Client not found" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: "Wrong password" });
        }

        // Generate JWT token
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
        res.json({ token });
    });
});

// Create a new service
app.post("/services", verifyToken, (req, res) => {
    const { name, description } = req.body;

    db.run(
        `INSERT INTO services (name, description) VALUES (?, ?)`,
        [name, description],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID });
        }
    );
});

// Modify an existing service
app.put("/services/:id", verifyToken, (req, res) => {
    const { name, description } = req.body;
    const { id } = req.params;

    db.run(
        `UPDATE services SET name = ?, description = ? WHERE id = ?`,
        [name, description, id],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: "Updated service" });
        }
    );
});

// Delete a service
app.delete("/services/:id", verifyToken, (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM services WHERE id = ?`, [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Deleted service" });
    });
});

// Swagger setup
const swaggerOptions = {
    swaggerDefinition: {
        info: {
            title: 'API Reservation System',
            version: '1.0.0',
            description: 'REST API to handle the reservations data',
        },
    },
    apis: ['index.js']
};

// Set swagger documentation
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running in port ${PORT}`);
});