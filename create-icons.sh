#!/bin/bash
# Simple script to create placeholder icons using ImageMagick or sips

SIZES=(16 48 128)
ICONS_DIR="icons"

mkdir -p "$ICONS_DIR"

for size in "${SIZES[@]}"; do
  # Try to create a simple colored square icon
  # Using sips to create a simple image (macOS)
  if command -v sips &> /dev/null; then
    # Create a temporary colored image
    python3 << PYEOF
from PIL import Image, ImageDraw
img = Image.new('RGB', ($size, $size), color='#667eea')
draw = ImageDraw.Draw(img)
# Draw gradient
for i in range($size):
    r = int(102 + (118 - 102) * i / $size)
    g = int(126 + (75 - 126) * i / $size)
    b = int(234 + (162 - 234) * i / $size)
    draw.rectangle([(0, i), ($size, i+1)], fill=(r, g, b))
# Draw white E
try:
    from PIL import ImageFont
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', int($size * 0.6))
except:
    font = ImageFont.load_default()
bbox = draw.textbbox((0, 0), 'E', font=font)
x = ($size - (bbox[2] - bbox[0])) // 2
y = ($size - (bbox[3] - bbox[1])) // 2
draw.text((x, y), 'E', fill='white', font=font)
img.save('$ICONS_DIR/icon${size}.png')
PYEOF
  fi
done

echo "Icons created in $ICONS_DIR/"
