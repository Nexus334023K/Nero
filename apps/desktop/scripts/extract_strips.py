import os
import numpy as np
from PIL import Image

ref_path = r"C:\Users\Nexus\.gemini\antigravity\brain\287829b3-b7a6-4b51-932a-6850371c0351\.user_uploaded\media_1794930456685_88e305f3.jpg"
out_dir = r"D:\Nero\apps\desktop\src\assets\companion"

img = Image.open(ref_path)

# Extract Avatar (Playful / Happy expression close-up)
# Expressions are located around x=275..350, y=430..530
avatar_box = (275, 432, 345, 505)
avatar_crop = img.crop(avatar_box)
avatar_crop = avatar_crop.resize((128, 128), Image.Resampling.LANCZOS)
avatar_crop.save(os.path.join(out_dir, "avatar.png"))
print("Saved avatar.png (128x128)")

# Also extract the 8 horizontal sprite strips from the reference sheet
sheet_rows = {
    "idle_raw_strip": (665, 260, 1010, 298),
    "talking_raw_strip": (665, 302, 1010, 340),
    "listening_raw_strip": (665, 344, 1010, 382),
    "thinking_raw_strip": (665, 386, 1010, 424),
    "happy_raw_strip": (665, 428, 1010, 466),
    "surprised_raw_strip": (665, 470, 1010, 508),
    "clicked_raw_strip": (665, 512, 1010, 550),
    "sleeping_raw_strip": (665, 554, 1010, 592),
}

for sname, sbox in sheet_rows.items():
    scrop = img.crop(sbox)
    scrop.save(os.path.join(out_dir, f"{sname}.png"))

print("Extracted raw sprite strips.")
