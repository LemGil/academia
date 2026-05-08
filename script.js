// script.js
document.addEventListener('DOMContentLoaded', () => {
    console.log('Academia del Espíritu - Iniciando interfaz de usuario...');
    waitForElectronAPI(() => {
        loadStudents(); 
        setupEventListeners();
    });
});

// --- Utilidades ---
function waitForElectronAPI(callback) { /* ... (igual que antes) ... */ 
    if (window.electronAPI) { callback(); } else { setTimeout(() => waitForElectronAPI(callback), 100); }
}
function displayErrorMessage(message) { alert(message); }

// --- Interacción con la Base de Datos (vía preload.js) ---

async function loadStudents() {
    console.log('Cargando estudiantes...');
    try {
        if (!window.electronAPI || !window.electronAPI.getAllStudents) throw new Error("window.electronAPI.getAllStudents no está disponible.");
        const students = await window.electronAPI.getAllStudents();
        if (students === undefined) {
            displayErrorMessage("Error al obtener estudiantes: La respuesta fue indefinida.");
            return;
        }
        displayStudents(students);
        console.log(`Cargados ${students.length} estudiantes.`);
    } catch (error) {
        console.error('Error en loadStudents (catch):', error);
        displayErrorMessage("No se pudieron cargar los estudiantes. Revisa la consola de Electron.");
    }
}

async function addStudent(studentData) {
    console.log('Intentando agregar estudiante via API:', studentData);
    try {
        if (!window.electronAPI || !window.electronAPI.addStudent) throw new Error("window.electronAPI.addStudent no está disponible.");
        
        // Convertir la fecha YYYY-MM-DD a timestamp tratando la fecha como local
        let fechaIngresoTimestamp = null;
        if (studentData.fecha_ingreso) {
            // Parsear YYYY-MM-DD como fecha local para evitar problemas de zona horaria
            const [year, month, day] = studentData.fecha_ingreso.split('-').map(Number);
            // Mes es 0-indexado en JavaScript (0 = Enero, 11 = Diciembre)
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                fechaIngresoTimestamp = date.getTime(); 
            } else {
                console.warn("Fecha inválida proporcionada para agregar:", studentData.fecha_ingreso);
            }
        }

        const newStudent = await window.electronAPI.addStudent({ 
            nombre: studentData.nombre, 
            contacto: studentData.contacto, 
            fecha_ingreso: fechaIngresoTimestamp // Enviamos el timestamp
        });
        console.log('Respuesta de addStudent:', newStudent);
        loadStudents();
        return newStudent;
    } catch (error) {
        console.error('Error al agregar estudiante (catch):', error);
        displayErrorMessage("No se pudo agregar el estudiante. Verifica los datos.");
        return null;
    }
}

async function updateStudent(studentData) {
    console.log('Intentando actualizar estudiante (llamada API):', studentData);
    try {
        if (!window.electronAPI || !window.electronAPI.updateStudent) throw new Error("window.electronAPI.updateStudent no está disponible.");
        
        // Convertir la fecha YYYY-MM-DD a timestamp tratando la fecha como local
        let fechaIngresoTimestamp = null;
        if (studentData.fecha_ingreso) {
            // Parsear YYYY-MM-DD como fecha local para evitar problemas de zona horaria
            const [year, month, day] = studentData.fecha_ingreso.split('-').map(Number);
            // Mes es 0-indexado en JavaScript (0 = Enero, 11 = Diciembre)
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
                fechaIngresoTimestamp = date.getTime();
            } else {
                console.warn("Fecha inválida proporcionada para actualizar:", studentData.fecha_ingreso);
            }
        }

        const updatedStudent = await window.electronAPI.updateStudent({ 
            id: studentData.id,
            nombre: studentData.nombre, 
            contacto: studentData.contacto, 
            fecha_ingreso: fechaIngresoTimestamp 
        });
        
        if (updatedStudent) {
            console.log('Respuesta de actualización exitosa:', updatedStudent);
            loadStudents();
            return updatedStudent;
        } else {
            console.warn('Estudiante no encontrado para actualizar (respuesta nula):', studentData.id);
            displayErrorMessage(`Estudiante con ID ${studentData.id} no encontrado.`);
            return null;
        }
    } catch (error) {
        console.error('Error en la llamada API updateStudent:', error);
        displayErrorMessage("No se pudo actualizar el estudiante. Verifica los datos.");
        return null;
    }
}

async function deleteStudent(studentId) { /* ... (igual que antes) ... */ 
    console.log(`Intentando eliminar estudiante con ID: ${studentId}`);
    try {
        if (!window.electronAPI || !window.electronAPI.deleteStudent) throw new Error("window.electronAPI.deleteStudent no está disponible.");
        const result = await window.electronAPI.deleteStudent(studentId);
        if (result && result.deleted) {
            console.log(`Estudiante con ID ${studentId} eliminado correctamente.`);
            loadStudents();
            return true;
        } else {
            console.warn(`Estudiante con ID ${studentId} no encontrado o no se pudo eliminar (resultado: ${JSON.stringify(result)})`);
            displayErrorMessage(`Estudiante con ID ${studentId} no encontrado o no se pudo eliminar.`);
            return false;
        }
    } catch (error) {
        console.error('Error en la llamada API deleteStudent:', error);
        displayErrorMessage("No se pudo eliminar el estudiante. Ocurrió un error.");
        return false;
    }
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
        if (!window.electronAPI || !window.electronAPI.getStudentById) throw new Error("window.electronAPI.getStudentById no está disponible.");
        
        const student = await window.electronAPI.getStudentById(studentId);
        
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
