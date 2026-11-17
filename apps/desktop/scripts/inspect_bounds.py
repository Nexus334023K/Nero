import os
import numpy as np
from PIL import Image
from collections import deque

out_dir = r"D:\Nero\apps\desktop\src\assets\companion"
ref_path = r"C:\Users\Nexus\.gemini\antigravity\brain\287829b3-b7a6-4b51-932a-6850371c0351\.user_uploaded\media_1794930456685_88e305f3.jpg"
img = Image.open(ref_path)

# Let's inspect the exact box for each character in the bottom row:
# Y range: 545 to 658 (just above text label "Idle" at 662)
# X centers for the 8 characters:
# Let's crop idle with some margin:
idle_box = (15, 545, 82, 658)
idle_crop = img.crop(idle_box)
idle_crop.save(os.path.join(out_dir, "test_idle_crop.png"))
print("Idle crop size:", idle_crop.size)

# Flood fill transparency from the 4 borders:
def flood_fill_transparency(crop, tolerance=18):
    rgb = np.array(crop.convert("RGB"))
    h, w, _ = rgb.shape
    
    # Sample corner background color
    corners = [rgb[0, 0], rgb[0, w-1], rgb[h-1, 0], rgb[h-1, w-1]]
    bg_ref = np.mean(corners, axis=0)
    print("Estimated BG color:", bg_ref)
    
    # Distance from background
    diff = np.sqrt(np.sum((rgb.astype(float) - bg_ref)**2, axis=2))
    is_bg_candidate = diff < tolerance
    
    # Flood fill starting from all 4 borders
    mask = np.zeros((h, w), dtype=bool)
    queue = deque()
    
    for x in range(w):
        if is_bg_candidate[0, x]:
            queue.append((0, x))
            mask[0, x] = True
        if is_bg_candidate[h-1, x]:
            queue.append((h-1, x))
            mask[h-1, x] = True
            
    for y in range(h):
        if is_bg_candidate[y, 0] and not mask[y, 0]:
            queue.append((y, 0))
            mask[y, 0] = True
        if is_bg_candidate[y, w-1] and not mask[y, w-1]:
            queue.append((y, w-1))
            mask[y, w-1] = True
            
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx]:
                # If it matches bg candidate or is very dark and close to parent
                if is_bg_candidate[ny, nx]:
                    mask[ny, nx] = True
                    queue.append((ny, nx))
                    
    # Create RGBA
    rgba = np.dstack([rgb, np.ones((h, w), dtype=np.uint8) * 255])
    # Set background pixels to transparent
    rgba[mask, 3] = 0
    
    # Soften edges (alpha feathering)
    # 1 pixel dilation around mask
    from scipy.ndimage import binary_dilation
    dilated = binary_dilation(mask, iterations=1)
    edge = dilated & (~mask)
    rgba[edge, 3] = 180
    
    return Image.fromarray(rgba, "RGBA")

try:
    import scipy
    has_scipy = True
except ImportError:
    has_scipy = False
print("Has scipy:", has_scipy)
