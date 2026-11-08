import sys
from PIL import Image

image_path = r"C:\Users\Ofir\.gemini\antigravity\brain\3d55649d-d0c8-4827-9174-cb2c78535892\media__1773563864623.png"

try:
    img = Image.open(image_path)
    print(f"Dimensions: {img.size}")
    print(f"Mode: {img.mode}")
    
    if img.mode == 'RGBA':
        bbox = img.getbbox()
        print(f"BBox (Alpha/Non-zero): {bbox}")
    else:
        print("No Alpha channel found.")
except Exception as e:
    print(f"Error: {e}")
