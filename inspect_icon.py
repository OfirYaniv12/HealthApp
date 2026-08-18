from PIL import Image
import os

filepath = r"c:\Users\Ofir\Desktop\HealthApp\assets\images\icon.png"

if not os.path.exists(filepath):
    print(f"File not found at {filepath}")
else:
    img = Image.open(filepath)
    print(f"Image Size: {img.size}")
    print(f"Image Mode: {img.mode}")
    
    # Print top-left corner 10x10 pixel colors
    pixels = img.load()
    print("Corner Pixels (10x10):")
    for y in range(10):
        row = []
        for x in range(10):
            row.append(str(pixels[x, y]))
        print(" | ".join(row))
