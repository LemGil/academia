# Academia del Espíritu - Versión Web

Aplicación web pura para la gestión de estudiantes de la Academia del Espíritu.

## Características

- ✅ **100% Web**: Funciona en cualquier navegador moderno
- ✅ **Sin dependencias**: No requiere Node.js, Electron ni SQLite
- ✅ **GitHub Pages compatible**: Listo para desplegar
- ✅ **localStorage**: Los datos se guardan en el navegador
- ✅ **Corrección de fechas**: Manejo correcto de zonas horarias

## Funcionalidades

### Gestión de Estudiantes
- Agregar nuevos estudiantes con nombre, contacto y fecha de ingreso
- Editar información de estudiantes existentes
- Eliminar estudiantes
- Visualizar lista completa de estudiantes en tabla

### Navegación
- Sección de Estudiantes (completa)
- Sección de Clases (pendiente)
- Sección de Progreso (pendiente)
- Sección de Resumen (pendiente)

## Despliegue en GitHub Pages

1. Sube este repositorio a GitHub
2. Ve a Settings > Pages
3. En "Source", selecciona tu rama principal (main/master)
4. Guarda los cambios
5. Tu app estará disponible en `https://tu-usuario.github.io/tu-repositorio`

## Uso Local

Simplemente abre el archivo `index.html` en tu navegador:

```bash
# Opción 1: Abrir directamente
firefox index.html

# Opción 2: Usar un servidor local
python3 -m http.server 8080
# Luego visita http://localhost:8080
```

## Estructura de Archivos

```
/
├── index.html      # Página principal
├── style.css       # Estilos CSS
├── script.js       # Lógica JavaScript (localStorage)
└── README.md       # Este archivo
```

## Almacenamiento de Datos

Los datos se guardan en el **localStorage** del navegador bajo la clave `academia_estudiantes`. Esto significa:

- ✅ Los datos persisten al cerrar el navegador
- ✅ No se requiere servidor backend
- ⚠️ Los datos son específicos del navegador/dispositivo
- ⚠️ Si borras el caché del navegador, se pierden los datos

## Formato de Fechas

La aplicación maneja correctamente las fechas:
- **Entrada**: YYYY-MM-DD (formato del input date)
- **Almacenamiento**: Timestamp (milisegundos UTC)
- **Visualización**: DD/MM/YYYY (formato local español)

## Tecnologías

- HTML5
- CSS3
- JavaScript (ES6+)
- localStorage API

## Licencia

© 2023 LemGil Ministerio Apostólico
