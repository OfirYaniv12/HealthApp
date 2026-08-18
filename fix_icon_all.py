from PIL import Image, ImageDraw
import os

files = [
    r"c:\Users\Ofir\Desktop\HealthApp\assets\images\icon.png",
    r"c:\Users\Ofir\Desktop\HealthApp\assets\images\android-icon-foreground.png",
    r"c:\Users\Ofir\Desktop\HealthApp\assets\images\android-icon-background.png",
    r"c:\Users\Ofir\Desktop\HealthApp\assets\images\android-icon-monochrome.png"
]

for filepath in files:
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
        
    try:
        img = Image.open(filepath).convert("RGBA")
        width, height = img.size
        
        # apply rounded corners mask for corners artifacts cleanup
        radius = 160 if width == 1024 else (width // 6)
        
        mask = Image.new('L', (width, height), 0)
        draw = ImageDraw.Draw(mask)
        draw.rounded_rectangle((0, 0, width, height), radius, fill=255)
        
        img.putalpha(mask)
        img.save(filepath, "PNG")
        print(f"Fixed: {filepath}")
    except Exception as e:
        print(f"Error on {filepath}: {e}")
