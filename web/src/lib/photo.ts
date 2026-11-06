// Photos people add to a recipe: shrunk on the phone to the seed photos' size
// (900x675, cropped to fill), then uploaded to the recipe-photos bucket under
// the household's folder. Returns the public URL to save as the recipe's image.
import { supabase } from './supabase.ts';

const WIDTH = 900;
const HEIGHT = 675;

/** Crops and scales to 900x675; WebP where the browser can write it, else JPEG. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(WIDTH / bitmap.width, HEIGHT / bitmap.height);
  const w = WIDTH / scale;
  const h = HEIGHT / scale;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - w) / 2, (bitmap.height - h) / 2, w, h, 0, 0, WIDTH, HEIGHT);
  bitmap.close();
  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await encode('image/webp', 0.8);
  // Older Safari writes PNG when asked for WebP.
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await encode('image/jpeg', 0.82);
  if (!jpeg) throw new Error('photo_encode');
  return jpeg;
}

export async function uploadPhoto(householdId: string, photo: Blob): Promise<string> {
  const ext = photo.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('recipe-photos').upload(path, photo, { contentType: photo.type, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return supabase.storage.from('recipe-photos').getPublicUrl(path).data.publicUrl;
}
