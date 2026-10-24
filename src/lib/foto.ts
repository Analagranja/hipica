const MAXIMO = 1024
const CALIDAD = 0.8
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function prepararFoto(archivo: File): Promise<Blob> {
  if (archivo.type && !TIPOS.has(archivo.type)) {
    throw new Error('La foto tiene que ser JPG, PNG o WebP.')
  }
  return reducir(archivo)
}

function reducir(archivo: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const imagen = new Image()

    imagen.onload = () => {
      const mayor = Math.max(imagen.width, imagen.height)
      const escala = mayor > MAXIMO ? MAXIMO / mayor : 1
      const ancho = Math.max(1, Math.round(imagen.width * escala))
      const alto = Math.max(1, Math.round(imagen.height * escala))
      const lienzo = document.createElement('canvas')
      lienzo.width = ancho
      lienzo.height = alto
      const contexto = lienzo.getContext('2d')
      if (!contexto) {
        URL.revokeObjectURL(url)
        reject(new Error('No se pudo preparar la foto.'))
        return
      }
      contexto.drawImage(imagen, 0, 0, ancho, alto)
      lienzo.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (!blob) reject(new Error('No se pudo preparar la foto.'))
          else resolve(blob)
        },
        'image/jpeg',
        CALIDAD,
      )
    }

    imagen.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la foto.'))
    }
    imagen.src = url
  })
}
