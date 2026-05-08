// main.js
const {
    app,
    BrowserWindow,
    ipcMain
} = require('electron');
const path = require('path');
const db = require('./database'); 

let mainWindow;

function createWindow() {
  
// main.js - Dentro de createWindow()
mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
        preload: path.join(__dirname, 'preload.js'), 
        nodeIntegration: false,
        contextIsolation: true,
        // --- ELIMINAMOS O COMENTAMOS LA LÍNEA DE CSP ---
        // contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
    }
});
// ... resto del código de main.js ...

    mainWindow.loadURL('file://' + path.join(__dirname, 'index.html')); 

    mainWindow.on('closed', () => { mainWindow = null; });
    // mainWindow.webContents.openDevTools(); 
}

// --- Manejadores IPC para la Base de Datos ---
ipcMain.handle('db-get-all-students', async (event) => {
    try { return await db.getAllStudents(); } 
    catch (error) { console.error('IPC Error getAllStudents:', error); throw error; }
});
ipcMain.handle('db-add-student', async (event, studentData) => {
    try { return await db.addStudent(studentData.nombre, studentData.contacto, studentData.fecha_ingreso); } 
    catch (error) { console.error('IPC Error addStudent:', error); throw error; }
});
ipcMain.handle('db-update-student', async (event, studentData) => {
    try { return await db.updateStudent(studentData.id, studentData.nombre, studentData.contacto, studentData.fecha_ingreso); } 
    catch (error) { console.error('IPC Error updateStudent:', error); throw error; }
});
ipcMain.handle('db-delete-student', async (event, studentId) => {
    try { return await db.deleteStudent(studentId); } 
    catch (error) { console.error('IPC Error deleteStudent:', error); throw error; }
});
// --- NUEVO MANEJADOR PARA GET STUDENT BY ID ---
ipcMain.handle('db-get-student-by-id', async (event, studentId) => {
    try { 
        console.log(`Main process: Recibido getStudentById para ID: ${studentId}`);
        return await db.getStudentById(studentId); 
    } 
    catch (error) { 
        console.error('IPC Error getStudentById:', error); 
        throw error; 
    }
});

// --- Ciclo de vida ---
app.on('ready', createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });

console.log('Electron main process iniciado.');


