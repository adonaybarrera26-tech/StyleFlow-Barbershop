// Fotos subidas desde el celular o la computadora: se recortan en cuadro y se achican
// para que pesen poco y se puedan guardar junto con el profesional.

const MAX_CHARS = 140000; // la base de datos acepta hasta 150,000 caracteres

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('invalid_image'));
    };
    img.src = url;
  });

// Regresa la foto como "data:image/jpeg;base64,..." de 480 x 480 px (recortada al centro).
// Errores: invalid_image (no es una imagen que se pueda leer) y image_too_big (no se logró achicar lo suficiente).
export const photoToDataUrl = async (file: File, side = 480): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error('invalid_image');
  const img = await loadImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('invalid_image');

  // Recorte cuadrado desde el centro
  const crop = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - crop) / 2;
  const sy = (img.naturalHeight - crop) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, side, side);
  ctx.drawImage(img, sx, sy, crop, crop, 0, 0, side, side);

  for (const quality of [0.85, 0.75, 0.65, 0.55]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_CHARS) return dataUrl;
  }
  throw new Error('image_too_big');
};
