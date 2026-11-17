import os
import numpy as np
from PIL import Image
from collections import deque

ref_path = r"C:\Users\Nexus\.gemini\antigravity\brain\287829b3-b7a6-4b51-932a-6850371c0351\.user_uploaded\media_1794930456685_88e305f3.jpg"
out_dir = r"D:\Nero\apps\desktop\src\assets\companion"

img = Image.open(ref_path)

# Exact bounding boxes for each of the 8 character poses:
# Top y is ~545 (or 540 for effects like question mark / sweat / sleeping Zs)
# Bottom y is 658 (above the text labels)
state_boxes = {
    "idle": (16, 545, 80, 658),
    "listening": (86, 545, 150, 658),
    "thinking": (156, 540, 222, 658),  # speech dots at top
    "talking": (226, 540, 292, 658),   # speech wave at top
    "happy": (296, 540, 362, 658),     # sparkles at top
    "surprised": (366, 540, 432, 658), # exclamation marks at top
    "clicked": (436, 540, 502, 658),   # impact sparks
    "sleeping": (502, 550, 575, 658),  # pillow & Zzz
}

def remove_background(crop, tolerance=24):
    rgb = np.array(crop.convert("RGB"))
    h, w, _ = rgb.shape
    
    # Background in the card is dark navy/teal: ~ [7..15, 12..22, 22..34]
    # Sample edges
    edge_pixels = np.concatenate([rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]], axis=0)
    bg_ref = np.median(edge_pixels, axis=0)
    
    diff = np.sqrt(np.sum((rgb.astype(float) - bg_ref)**2, axis=2))
    
    # We want to flood fill from borders to avoid touching dark hoodie/hair
    is_bg = diff < tolerance
    # Also background has very low saturation/luminance and distinct teal hue
    # Pixels where r < 18, g < 28, b < 40 and close to edges
    mask = np.zeros((h, w), dtype=bool)
    queue = deque()
    
    for x in range(w):
        if is_bg[0, x]:
            queue.append((0, x))
            mask[0, x] = True
        if is_bg[h-1, x]:
            queue.append((h-1, x))
            mask[h-1, x] = True
            
    for y in range(h):
        if is_bg[y, 0] and not mask[y, 0]:
            queue.append((y, 0))
            mask[y, 0] = True
        if is_bg[y, w-1] and not mask[y, w-1]:
            queue.append((y, w-1))
            mask[y, w-1] = True
            
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx]:
                if is_bg[ny, nx]:
                    mask[ny, nx] = True
                    queue.append((ny, nx))
                    
    rgba = np.dstack([rgb, np.ones((h, w), dtype=np.uint8) * 255])
    rgba[mask, 3] = 0
    
    # Smooth edges
    for y in range(1, h-1):
        for x in range(1, w-1):
            if not mask[y, x]:
                # If adjacent to mask, smooth alpha
                adj_bg = mask[y-1, x] or mask[y+1, x] or mask[y, x-1] or mask[y, x+1]
                if adj_bg and diff[y, x] < tolerance + 10:
                    rgba[y, x, 3] = int(255 * (diff[y, x] / (tolerance + 10)))
                    
    return Image.fromarray(rgba, "RGBA")

# Extract and upscale cleanly to standard 256x256 square frames
for name, box in state_boxes.items():
    crop = img.crop(box)
    clean_crop = remove_background(crop, tolerance=22)
    
    # Place on 256x256 transparent canvas centered
    canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    # Resize keeping aspect ratio so character fits nicely in ~200px height
    cw, ch = clean_crop.size
    scale = 210.0 / ch
    nw = int(cw * scale)
    nh = int(ch * scale)
    resized = clean_crop.resize((nw, nh), Image.Resampling.LANCZOS)
    
    # Center horizontally and position feet near bottom
    pos_x = (256 - nw) // 2
    pos_y = 256 - nh - 18
    canvas.paste(resized, (pos_x, pos_y), resized)
    
    out_path = os.path.join(out_dir, f"{name}.png")
    canvas.save(out_path)
    print(f"Saved 256x256 {name}.png: box={box}, scaled to {nw}x{nh}")

print("All 8 state poses saved cleanly as 256x256 transparent PNGs!")
