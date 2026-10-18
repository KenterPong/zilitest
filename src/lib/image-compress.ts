/**
 * 瀏覽器端圖片壓縮：縮到長邊 IMAGE_MAX_EDGE、轉成 JPEG，再上傳做圖片轉文字。
 * HEIC 只有部分瀏覽器（如 Safari）能解碼，解碼失敗時丟 ImageDecodeError。
 */

import { fitWithin, IMAGE_MAX_EDGE } from '@/lib/extraction'

export class ImageDecodeError extends Error {}

export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageDecodeError('這個瀏覽器無法讀取這張圖片，請改用截圖或 JPG、PNG 圖片')
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height, IMAGE_MAX_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new ImageDecodeError('無法處理這張圖片，請換一張試試')
  }
  // 透明背景（PNG 截圖）轉 JPEG 會變黑，先鋪白底
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new ImageDecodeError('無法處理這張圖片，請換一張試試')
  return blob
}
