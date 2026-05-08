document.addEventListener('DOMContentLoaded', () => {
    console.log('Script de test cargado.');
    if (window.electronAPI && window.electronAPI.ping) {
        window.electronAPI.ping()
            .then(response => {
                console.log('Respuesta de IPC:', response);
                if (response === 'pong') {
                    console.log('¡IPC funciona!');
                    alert('¡La comunicación IPC está funcionando!');
                } else {
                    console.error('Respuesta inesperada de IPC:', response);
                }
            })
            .catch(error => {
                console.error('Error en la llamada IPC:', error);
            });
    } else {
        console.error('window.electronAPI.ping no está disponible.');
        alert('Error: window.electronAPI.ping no está disponible.');
    }
});
