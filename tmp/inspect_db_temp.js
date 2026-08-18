const { openDatabase } = require('./db/database_inspect_helper'); // I will make a quick helper to open and query
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join('c:', 'Users', 'Ofir', 'Desktop', 'HealthApp', 'healthapp.db'); // Where is the db?
// Wait, the DB in Expo SQLite often defaults into absolute Simulator paths or app directories.
// Let's find where the .db file lives or query it via a script!
