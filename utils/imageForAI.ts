import { ImagePickerAsset } from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Prepares a photo for the AI: scales it down and compresses it.
 *
 * Why: on the website the browser hands over the ORIGINAL photo (phone photos are several MB), and the
 * server rejects requests over ~4.5 MB, so photos failed with "AI error". 1600 px on the long side is
 * plenty for reading a nutrition label or a watch screenshot, and comes out at a few hundred KB.
 */
const MAX_SIDE = 1600;

export const prepareImageForAI = async (asset: ImagePickerAsset): Promise<string | null> => {
    try {
        const w = asset.width || 0;
        const h = asset.height || 0;
        const resize = w > MAX_SIDE || h > MAX_SIDE || !w || !h
            ? [{ resize: w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE } }]
            : [];
        const result = await manipulateAsync(asset.uri, resize, { compress: 0.7, format: SaveFormat.JPEG, base64: true });
        if (result.base64) return `data:image/jpeg;base64,${result.base64}`;
    } catch (e) {
        console.warn('Image resize failed, sending the original', e);
    }
    // Fallback: the original (works for small images)
    if (asset.base64) return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
    return asset.uri.startsWith('data:') ? asset.uri : null;
};
