// Sube la vista al principio. El área que se desplaza en la app es
// `.contenido` (ver App.tsx y index.css); se resetea también el scroll
// de la ventana por si el navegador lo usa en algún tamaño de pantalla.
export function irAlInicio() {
  const zona = document.querySelector('.contenido')
  if (zona) zona.scrollTo({ top: 0, left: 0 })
  window.scrollTo(0, 0)
}
