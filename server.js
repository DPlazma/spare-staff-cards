const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir);
}

// Database setup
const db = new sqlite3.Database('./data/cards.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY,
    uid TEXT UNIQUE,
    name TEXT,
    status TEXT DEFAULT 'available'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY,
    card_id INTEGER,
    staff_name TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    returned_at DATETIME,
    FOREIGN KEY (card_id) REFERENCES cards(id)
  )`);
  // Insert some sample cards if not exist
  db.run(`INSERT OR IGNORE INTO cards (uid, name) VALUES ('CARD001', 'Card 1'), ('CARD002', 'Card 2'), ('CARD003', 'Card 3'), ('CARD004', 'Card 4'), ('CARD005', 'Card 5')`);
});

// Routes
app.get('/api/logs', (req, res) => {
  const query = `
    SELECT a.id, c.name as card_name, c.uid, a.staff_name, a.assigned_at, a.returned_at 
    FROM assignments a 
    JOIN cards c ON a.card_id = c.id 
    ORDER BY a.assigned_at DESC
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/cards/available', (req, res) => {
  db.all("SELECT * FROM cards WHERE status = 'available'", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/cards/assigned', (req, res) => {
  db.all("SELECT a.id, c.uid, c.name, a.staff_name, a.assigned_at FROM assignments a JOIN cards c ON a.card_id = c.id WHERE a.returned_at IS NULL", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/assign', (req, res) => {
  const { cardId, staffName } = req.body;
  db.run("UPDATE cards SET status = 'assigned' WHERE id = ?", [cardId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run("INSERT INTO assignments (card_id, staff_name) VALUES (?, ?)", [cardId, staffName], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Card assigned' });
    });
  });
});

app.post('/api/return/:assignmentId', (req, res) => {
  const assignmentId = req.params.assignmentId;
  db.get("SELECT card_id FROM assignments WHERE id = ?", [assignmentId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Assignment not found' });
    db.run("UPDATE assignments SET returned_at = CURRENT_TIMESTAMP WHERE id = ?", [assignmentId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.run("UPDATE cards SET status = 'available' WHERE id = ?", [row.card_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Card returned' });
      });
    });
  });
});

app.get('/api/cards', (req, res) => {
  db.all("SELECT * FROM cards", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/cards', (req, res) => {
  const { uid, name } = req.body;
  db.run("INSERT INTO cards (uid, name) VALUES (?, ?)", [uid, name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/cards/:id', (req, res) => {
  const { name } = req.body;
  const id = req.params.id;
  db.run("UPDATE cards SET name = ? WHERE id = ?", [name, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Updated' });
  });
});

app.delete('/api/cards/:id', (req, res) => {
  const id = req.params.id;
  db.get("SELECT status FROM cards WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Card not found' });
    if (row.status !== 'available') return res.status(400).json({ error: 'Cannot delete assigned card' });
    db.run("DELETE FROM cards WHERE id = ?", [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Deleted' });
    });
  });
});

app.post('/api/assign-by-uid', (req, res) => {
  const { uid, staffName } = req.body;
  db.get("SELECT id FROM cards WHERE uid = ?", [uid], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Card not found' });
    const cardId = row.id;
    db.run("UPDATE cards SET status = 'assigned' WHERE id = ?", [cardId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.run("INSERT INTO assignments (card_id, staff_name) VALUES (?, ?)", [cardId, staffName], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Card assigned' });
      });
    });
  });
});

app.post('/api/return-by-uid', (req, res) => {
  const { uid } = req.body;
  db.get("SELECT a.id as assignment_id FROM assignments a JOIN cards c ON a.card_id = c.id WHERE c.uid = ? AND a.returned_at IS NULL", [uid], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'No active assignment for this card' });
    const assignmentId = row.assignment_id;
    db.run("UPDATE assignments SET returned_at = CURRENT_TIMESTAMP WHERE id = ?", [assignmentId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get("SELECT card_id FROM assignments WHERE id = ?", [assignmentId], (err, row) => {
        db.run("UPDATE cards SET status = 'available' WHERE id = ?", [row.card_id]);
        res.json({ message: 'Card returned' });
      });
    });
  });
});

app.post('/api/tap-action', (req, res) => {
  const { uid, staffName } = req.body;
  db.get("SELECT id, status FROM cards WHERE uid = ?", [uid], (err, card) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!card) return res.status(404).json({ error: 'Card not found' });
    if (card.status === 'available') {
      if (!staffName) return res.status(400).json({ error: 'Staff name required for assignment' });
      db.run("UPDATE cards SET status = 'assigned' WHERE id = ?", [card.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.run("INSERT INTO assignments (card_id, staff_name) VALUES (?, ?)", [card.id, staffName], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Card assigned', action: 'assigned' });
        });
      });
    } else {
      // Return
      db.get("SELECT a.id as assignment_id FROM assignments a WHERE a.card_id = ? AND a.returned_at IS NULL", [card.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(400).json({ error: 'Card is assigned but no active assignment found' });
        const assignmentId = row.assignment_id;
        db.run("UPDATE assignments SET returned_at = CURRENT_TIMESTAMP WHERE id = ?", [assignmentId], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          db.run("UPDATE cards SET status = 'available' WHERE id = ?", [card.id]);
          res.json({ message: 'Card returned', action: 'returned' });
        });
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});