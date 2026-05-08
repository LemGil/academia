// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Funciones para Estudiantes
    getAllStudents: () => ipcRenderer.invoke('db-get-all-students'),
    addStudent: (studentData) => ipcRenderer.invoke('db-add-student', studentData),
    updateStudent: (studentData) => ipcRenderer.invoke('db-update-student', studentData),
    deleteStudent: (studentId) => ipcRenderer.invoke('db-delete-student', studentId),
// preload.js - Añade esta línea dentro de contextBridge.exposeInMainWorld
getStudentById: (studentId) => ipcRenderer.invoke('db-get-student-by-id', studentId),
});

console.log('Preload script cargado.');
