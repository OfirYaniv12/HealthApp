from PIL import Image, ImageDraw
import os

filepath = r"c:\Users\Ofir\Desktop\HealthApp\assets\images\icon.png"

if not os.path.exists(filepath):
    print(f"File not found at {filepath}")
else:
    img = Image.open(filepath).convert("RGBA")
    width, height = img.size

    # Create mask for rounded corners
    # radius is usually around 15% of width for standard app icons (e.g. 160px for 1024)
    radius = 160 
    
    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, width, height), radius, fill=255)

    # Apply mask
    img.putalpha(mask)
    
    # Save back
    img.save(filepath, "PNG")
    print(f"Applied rounded mask with radius {radius} to {filepath}")
