// Modules Import
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

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
            email TEXT NOT NULL
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

// Endpoint base
app.get("/", (req, res) => {
    res.send("Reservation System API");
});

// Create a new reservation
app.post("/reservations", (req, res) => {
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

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running in port ${PORT}`);
});