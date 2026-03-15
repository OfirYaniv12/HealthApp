import sys
from PIL import Image

image_path = r"C:\Users\Ofir\Desktop\HealthApp\assets\images"
source_path = r"C:\Users\Ofir\.gemini\antigravity\brain\3d55649d-d0c8-4827-9174-cb2c78535892\media__1773563864623.png"
output_path = r"C:\Users\Ofir\Desktop\HealthApp\assets\images\icon.png"

try:
    print(f"Loading image from {source_path}")
    img = Image.open(source_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
        
    width, height = img.size
    pixels = img.load()

    min_x, min_y = width, height
    max_x, max_y = 0, 0

    print("Scanning pixels for non-grey colors (the icon)...")
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # Standard Grey/White means R == G == B (or very close)
            # Teal icon has high color variance (r != g or g != b)
            if abs(r - g) > 10 or abs(g - b) > 10 or abs(r - b) > 10:
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y

    print(f"Detected Icon Bounding Box: ({min_x}, {min_y}) to ({max_x}, {max_y})")
    
    if max_x > min_x and max_y > min_y:
        # Give a small padding if too tight? No, border is fine
        cropped_img = img.crop((min_x, min_y, max_x, max_y))
        
        # Optionally resize to 1024x1024 or keep it
        # standard square, let's keep it native or resize to 1024x1024 if preferred
        # because Expo is picky with icon sizes. 
        # Actually standard sizes: icon.png is usually 1024x1024.
        final_img = cropped_img.resize((1024, 1024), Image.Resampling.LANCZOS)
        final_img.save(output_path, "PNG")
        print(f"Success! Cropped asset saved to {output_path}")
        
        # Save variant for adaptive icon foreground just in case
        foreground_path = r"C:\Users\Ofir\Desktop\HealthApp\assets\images\android-icon-foreground.png"
        final_img.save(foreground_path, "PNG")
        print(f"Success! Adaptive foreground saved to {foreground_path}")
        
    else:
        print("Error: Could not find non-grey pixels to crop!")

except Exception as e:
    print(f"Error during cropping: {e}")
    sys.exit(1)
