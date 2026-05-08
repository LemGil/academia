// database.js - Reemplaza el contenido completo con esto
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'academia_espiritu.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al abrir la base de datos:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Tabla de Estudiantes - fecha_ingreso ahora es INTEGER para almacenar timestamp UTC
        db.run(`CREATE TABLE IF NOT EXISTS estudiantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            contacto TEXT,
            fecha_ingreso INTEGER NOT NULL -- Almacenaremos el timestamp (milisegundos UTC)
        )`, (err) => {
            if (err) console.error('Error al crear la tabla estudiantes:', err.message);
            else console.log('Tabla "estudiantes" creada o ya existente.');
        });
        // ... (Otras tablas si las hubiera) ...
    });
}

// --- Funciones CRUD para Estudiantes ---

function addStudent(nombre, contacto, fechaIngresoTimestamp) { // Recibe timestamp
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO estudiantes (nombre, contacto, fecha_ingreso) VALUES (?, ?, ?)`;
        db.run(sql, [nombre, contacto, fechaIngresoTimestamp], function(err) {
            if (err) { console.error('Error al agregar estudiante:', err.message); reject(err); } 
            else { console.log(`Estudiante agregado con ID: ${this.lastID}`); resolve({ id: this.lastID, nombre, contacto, fecha_ingreso: fechaIngresoTimestamp }); }
        });
    });
}

function getAllStudents() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM estudiantes ORDER BY nombre ASC`;
        db.all(sql, [], (err, rows) => {
            if (err) { console.error('Error al obtener estudiantes:', err.message); reject(err); } 
            else { resolve(rows); } // rows serán objetos con timestamps
        });
    });
}

function updateStudent(id, nombre, contacto, fechaIngresoTimestamp) { // Recibe timestamp
    return new Promise((resolve, reject) => {
        const sql = `UPDATE estudiantes SET nombre = ?, contacto = ?, fecha_ingreso = ? WHERE id = ?`;
        db.run(sql, [nombre, contacto, fechaIngresoTimestamp, id], function(err) {
            if (err) { console.error('Error al actualizar estudiante:', err.message); reject(err); }
            else { resolve(this.changes > 0 ? { id: id, nombre, contacto, fecha_ingreso: fechaIngresoTimestamp } : null); }
        });
    });
}

function deleteStudent(id) { /* ... (igual que antes) ... */ 
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM estudiantes WHERE id = ?`;
        db.run(sql, [id], function(err) {
            if (err) { console.error('Error al eliminar estudiante:', err.message); reject(err); }
            else { resolve({ id: id, deleted: this.changes > 0 }); }
        });
    });
}

function getStudentById(id) { /* ... (igual que antes) ... */ 
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM estudiantes WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            if (err) { console.error('Error al obtener estudiante por ID:', err.message); reject(err); }
            else { resolve(row); }
        });
    });
}

module.exports = { addStudent, getAllStudents, updateStudent, deleteStudent, getStudentById };
console.log('Database module cargado.');
