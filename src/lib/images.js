// Shrink a picked photo in the browser before uploading: any size or common format in,
// a small JPEG out. Phone photos are often 5-10 MB with odd extensions (.jfif, none);
// a profile picture never needs more than this.
export async function shrinkToJpeg(file, { maxSize = 512, quality = 0.86 } = {}) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("This photo format can't be read here. Try a JPG or PNG (iPhone HEIC photos: export as JPG first).")
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // transparent PNGs get a white background instead of black
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error("Couldn't process that photo. Try a different one.")
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
}
