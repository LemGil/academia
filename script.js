// script.js - Versión Web Pura (sin Electron, sin SQLite)
// Usa localStorage para almacenar los datos

document.addEventListener('DOMContentLoaded', () => {
    console.log('Academia del Espíritu - Iniciando interfaz de usuario...');
    loadStudents(); 
    setupEventListeners();
});

// --- Utilidades ---

// Generar ID único
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Guardar estudiantes en localStorage
function saveStudentsToStorage(students) {
    localStorage.setItem('academia_estudiantes', JSON.stringify(students));
}

// Obtener estudiantes de localStorage
function getStudentsFromStorage() {
    const stored = localStorage.getItem('academia_estudiantes');
    return stored ? JSON.parse(stored) : [];
}

function displayErrorMessage(message) { 
    alert(message); 
}

// --- Funciones de Base de Datos (usando localStorage) ---

async function loadStudents() {
    console.log('Cargando estudiantes...');
    try {
        const students = getStudentsFromStorage();
        displayStudents(students);
        console.log(`Cargados ${students.length} estudiantes.`);
    } catch (error) {
        console.error('Error en loadStudents:', error);
        displayErrorMessage("No se pudieron cargar los estudiantes.");
    }
}

async function addStudent(studentData) {
    console.log('Agregando estudiante:', studentData);
    try {
        const students = getStudentsFromStorage();
        
        // Convertir la fecha YYYY-MM-DD a timestamp tratando la fecha como local
        let fechaIngresoTimestamp = null;
        if (studentData.fecha_ingreso) {
            const [year, month, day] = studentData.fecha_ingreso.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                fechaIngresoTimestamp = date.getTime(); 
            } else {
                console.warn("Fecha inválida proporcionada para agregar:", studentData.fecha_ingreso);
            }
        }

        const newStudent = { 
            id: generateId(),
            nombre: studentData.nombre, 
            contacto: studentData.contacto, 
            fecha_ingreso: fechaIngresoTimestamp
        };
        
        students.push(newStudent);
        saveStudentsToStorage(students);
        
        console.log('Estudiante agregado:', newStudent);
        loadStudents();
        return newStudent;
    } catch (error) {
        console.error('Error al agregar estudiante:', error);
        displayErrorMessage("No se pudo agregar el estudiante. Verifica los datos.");
        return null;
    }
}

async function updateStudent(studentData) {
    console.log('Actualizando estudiante:', studentData);
    try {
        const students = getStudentsFromStorage();
        const index = students.findIndex(s => s.id === studentData.id);
        
        if (index === -1) {
            console.warn('Estudiante no encontrado para actualizar:', studentData.id);
            displayErrorMessage(`Estudiante con ID ${studentData.id} no encontrado.`);
            return null;
        }
        
        // Convertir la fecha YYYY-MM-DD a timestamp tratando la fecha como local
        let fechaIngresoTimestamp = null;
        if (studentData.fecha_ingreso) {
            const [year, month, day] = studentData.fecha_ingreso.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                fechaIngresoTimestamp = date.getTime();
            } else {
                console.warn("Fecha inválida proporcionada para actualizar:", studentData.fecha_ingreso);
            }
        }

        students[index] = { 
            id: studentData.id,
            nombre: studentData.nombre, 
            contacto: studentData.contacto, 
            fecha_ingreso: fechaIngresoTimestamp 
        };
        
        saveStudentsToStorage(students);
        console.log('Estudiante actualizado:', students[index]);
        loadStudents();
        return students[index];
    } catch (error) {
        console.error('Error al actualizar estudiante:', error);
        displayErrorMessage("No se pudo actualizar el estudiante. Verifica los datos.");
        return null;
    }
}

async function deleteStudent(studentId) {
    console.log(`Eliminando estudiante con ID: ${studentId}`);
    try {
        let students = getStudentsFromStorage();
        const initialLength = students.length;
        students = students.filter(s => s.id !== studentId);
        
        if (students.length < initialLength) {
            saveStudentsToStorage(students);
            console.log(`Estudiante con ID ${studentId} eliminado correctamente.`);
            loadStudents();
            return true;
        } else {
            console.warn(`Estudiante con ID ${studentId} no encontrado.`);
            displayErrorMessage(`Estudiante con ID ${studentId} no encontrado.`);
            return false;
        }
    } catch (error) {
        console.error('Error al eliminar estudiante:', error);
        displayErrorMessage("No se pudo eliminar el estudiante.");
        return false;
    }
}

async function getStudentById(studentId) {
    const students = getStudentsFromStorage();
    return students.find(s => s.id === studentId) || null;
}


// --- Renderizado de la Interfaz ---
function displayStudents(students) {
    const studentListDiv = document.getElementById('student-list');
    if (!studentListDiv) { console.error('Elemento "student-list" no encontrado.'); return; }
    studentListDiv.innerHTML = ''; 

    if (students.length === 0) {
        studentListDiv.innerHTML = '<p>No hay estudiantes registrados.</p>';
        return;
    }

    let tableHTML = `
        <table>
            <thead>
                <tr><th>Nombre</th><th>Contacto</th><th>Fecha de Ingreso</th><th>Acciones</th></tr>
            </thead>
            <tbody>
    `;

    students.forEach(student => {
        let formattedDate = 'N/A';
        if (student.fecha_ingreso) { // student.fecha_ingreso ahora es un timestamp (milisegundos UTC)
            try {
                // Convertimos el timestamp a un objeto Date, que JS maneja en UTC por defecto si es un número
                const date = new Date(student.fecha_ingreso);
                // Verificamos si la fecha es válida
                if (!isNaN(date.getTime())) {
                    // Formateamos la fecha a local ES. Esto debería manejar la conversión de UTC a local.
                    formattedDate = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                } else {
                    console.warn("Fecha inválida parseada desde timestamp:", student.fecha_ingreso);
                    formattedDate = student.fecha_ingreso; // Mostrarla como viene si no es válida
                }
            } catch (e) {
                console.error("Error formateando fecha desde timestamp:", student.fecha_ingreso, e);
                formattedDate = student.fecha_ingreso;
            }
        }

        tableHTML += `
            <tr>
                <td>${student.nombre}</td><td>${student.contacto || 'N/A'}</td><td>${formattedDate}</td>
                <td>
                    <button class="professional-button edit-btn" data-id="${student.id}">Editar</button>
                    <button class="professional-button delete-btn" data-id="${student.id}">Eliminar</button>
                </td>
            </tr>
        `;
    });
    tableHTML += `</tbody></table>`;
    studentListDiv.innerHTML = tableHTML;
}

// --- Manejo de Eventos y Formularios ---
function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Formulario de agregar estudiante
    const studentForm = document.getElementById('student-form');
    if (studentForm) {
        studentForm.addEventListener('submit', handleAddStudentForm);
    } else { console.warn('Formulario de estudiante "student-form" no encontrado.'); }

    // Delegación de eventos para botones de tabla
    const studentListDiv = document.getElementById('student-list');
    if (studentListDiv) {
        studentListDiv.addEventListener('click', (event) => {
            const target = event.target;
            const studentId = target.getAttribute('data-id');
            if (!studentId) return;

            if (target.classList.contains('edit-btn')) {
                console.log(`Clic en Editar para ID: ${studentId}`);
                fetchStudentDataAndOpenEditModal(studentId); 
            } else if (target.classList.contains('delete-btn')) {
                console.log(`Clic en Eliminar para ID: ${studentId}`);
                confirmDeleteStudent(studentId);
            }
        });
    } else { console.warn('Div "student-list" no encontrado para delegación de eventos.'); }

    // Navegación
    document.querySelectorAll('nav ul li a').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const sectionId = event.currentTarget.getAttribute('href').substring(1);
            displaySection(sectionId);
        });
    });
    
    displaySection('estudiantes'); // Mostrar sección de estudiantes por defecto

    // Event listeners para el modal
    const closeButton = document.querySelector('.modal .close-button');
    if (closeButton) { closeButton.addEventListener('click', hideEditStudentModal); }
    const cancelEditButton = document.getElementById('cancelEditButton');
    if (cancelEditButton) { cancelEditButton.addEventListener('click', hideEditStudentModal); }
    const editForm = document.getElementById('editStudentForm');
    if (editForm) { editForm.addEventListener('submit', handleEditStudentFormSubmit); }

    console.log('Event listeners configurados.');
}

function handleAddStudentForm(event) { 
    event.preventDefault();
    const form = event.target;
    const nombre = form.querySelector('#student-nombre').value.trim();
    const contacto = form.querySelector('#student-contacto').value.trim();
    const fechaIngresoInput = form.querySelector('#student-fecha-ingreso');
    const fechaIngresoValue = fechaIngresoInput.value; // Valor del input date (YYYY-MM-DD)

    if (!nombre || !fechaIngresoValue) {
        displayErrorMessage("El nombre y la fecha de ingreso son obligatorios.");
        return;
    }
    // Convertimos YYYY-MM-DD a timestamp antes de enviar
    const newStudentData = { 
        nombre: nombre, 
        contacto: contacto || null, 
        fecha_ingreso: fechaIngresoValue // Enviamos la cadena YYYY-MM-DD directamente
    };
    addStudent(newStudentData).then(addedStudent => {
        if (addedStudent) { form.reset(); }
    });
}

// --- Funciones del Modal de Edición ---

async function fetchStudentDataAndOpenEditModal(studentId) {
    console.log(`Buscando datos para editar estudiante ID: ${studentId}`);
    try {
        const student = await getStudentById(studentId);
        
        if (!student) {
            displayErrorMessage(`Estudiante con ID ${studentId} no encontrado.`);
            return;
        }
        
        console.log('Datos del estudiante obtenidos:', student);
        populateEditModal(student); 
        showEditStudentModal();
        
    } catch (error) {
        console.error(`Error al obtener datos para editar estudiante ID ${studentId}:`, error);
        displayErrorMessage("No se pudieron cargar los datos del estudiante para editar.");
    }
}

function populateEditModal(student) {
    const studentIdInput = document.getElementById('edit-student-id');
    const nombreInput = document.getElementById('edit-student-nombre');
    const contactoInput = document.getElementById('edit-student-contacto');
    const fechaIngresoInput = document.getElementById('edit-student-fecha-ingreso');

    if (!studentIdInput || !nombreInput || !contactoInput || !fechaIngresoInput) {
        console.error("No se encontraron todos los elementos del modal.");
        return;
    }

    studentIdInput.value = student.id;
    nombreInput.value = student.nombre;
    contactoInput.value = student.contacto || '';
    
    let formattedDateForInput = '';
    if (student.fecha_ingreso) { // student.fecha_ingreso es un timestamp
        try {
            const date = new Date(student.fecha_ingreso); // Crea Date desde timestamp
            if (!isNaN(date.getTime())) {
                // Formateamos la fecha para el input type="date" (YYYY-MM-DD)
                // Aseguramos que el mes y el día tengan dos dígitos (ej: 05 en lugar de 5)
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0'); // getMonth() es 0-based
                const day = String(date.getDate()).padStart(2, '0');
                formattedDateForInput = `${year}-${month}-${day}`;
            } else {
                console.warn("Timestamp de fecha inválido para el input:", student.fecha_ingreso);
                formattedDateForInput = '';
            }
        } catch (e) {
            console.error("Error formateando fecha desde timestamp para el input:", student.fecha_ingreso, e);
            formattedDateForInput = '';
        }
    }
    fechaIngresoInput.value = formattedDateForInput;
}

function showEditStudentModal() { const modal = document.getElementById('editStudentModal'); if(modal) modal.style.display = 'block'; console.log('Modal de edición mostrado.'); }
function hideEditStudentModal() { const modal = document.getElementById('editStudentModal'); if(modal) modal.style.display = 'none'; document.getElementById('editStudentForm').reset(); currentStudentIdForEditing = null; console.log('Modal de edición oculto.'); }

function handleEditStudentFormSubmit(event) {
    event.preventDefault(); 
    const form = event.target;
    const studentId = form.querySelector('#edit-student-id').value;
    const nombre = form.querySelector('#edit-student-nombre').value.trim();
    const contacto = form.querySelector('#edit-student-contacto').value.trim();
    const fechaIngresoValue = form.querySelector('#edit-student-fecha-ingreso').value; // Valor del input date (YYYY-MM-DD)

    if (!nombre || !fechaIngresoValue) {
        displayErrorMessage("El nombre y la fecha de ingreso son obligatorios.");
        return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(fechaIngresoValue)) {
        displayErrorMessage("El formato de fecha debe ser YYYY-MM-DD.");
        return;
    }

    const updatedStudentData = {
        id: parseInt(studentId),
        nombre: nombre,
        contacto: contacto || null,
        fecha_ingreso: fechaIngresoValue // Enviamos la cadena YYYY-MM-DD
    };

    console.log('Datos a enviar desde el modal para actualizar:', updatedStudentData);

    updateStudent(updatedStudentData).then(result => {
        if (result) { alert(`Estudiante "${updatedStudentData.nombre}" actualizado con éxito.`); hideEditStudentModal(); }
    }).catch(error => {
        console.error('Error en la promesa de handleEditStudentFormSubmit:', error);
        displayErrorMessage("Ocurrió un error inesperado al actualizar el estudiante.");
        hideEditStudentModal(); 
    });
}

function confirmDeleteStudent(studentId) { /* ... (igual que antes) ... */ 
    console.log(`Confirmando eliminación para estudiante ID: ${studentId}`);
    if (confirm('¿Estás seguro de que deseas eliminar a este estudiante? Esta acción no se puede deshacer.')) {
        deleteStudent(studentId).then(success => {
            if (success) { alert('Estudiante eliminado correctamente.'); }
        }).catch(error => {
            console.error('Error en la promesa de deleteStudent:', error);
            displayErrorMessage("Ocurrió un error inesperado al eliminar el estudiante.");
        });
    } else { console.log("Eliminación cancelada por el usuario."); }
}

function displaySection(sectionId) { /* ... (igual que antes) ... */ 
    document.querySelectorAll('main section').forEach(section => { section.style.display = 'none'; });
    const sectionToShow = document.getElementById(sectionId);
    if (sectionToShow) { sectionToShow.style.display = 'block'; } 
    else { console.warn(`Sección con ID "${sectionId}" no encontrada.`); }
}
