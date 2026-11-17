import os
import numpy as np
from PIL import Image, ImageDraw

out_dir = r"D:\Nero\apps\desktop\src\assets\companion"
FRAME_W = 256
FRAME_H = 256
NUM_FRAMES = 8

states = ["idle", "listening", "thinking", "talking", "happy", "surprised", "clicked", "sleeping"]

for state in states:
    base_path = os.path.join(out_dir, f"{state}.png")
    if not os.path.exists(base_path):
        print(f"Missing base: {base_path}")
        continue
    base_img = Image.open(base_path).convert("RGBA")
    
    # Create 2048x256 sheet
    sheet = Image.new("RGBA", (FRAME_W * NUM_FRAMES, FRAME_H), (0, 0, 0, 0))
    
    for i in range(NUM_FRAMES):
        frame = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
        
        # Micro-variations per state
        offset_y = 0
        offset_x = 0
        scale_y = 1.0
        
        if state == "idle":
            # 8-frame subtle breathing cycle: 0, 1, 2, 3, 3, 2, 1, 0
            bobs = [0, -1, -2, -3, -3, -2, -1, 0]
            offset_y = bobs[i]
            frame.paste(base_img, (0, offset_y), base_img)
            
            # Add subtle eye blink on frame 4
            if i == 4:
                # Add subtle blink overlay
                draw = ImageDraw.Draw(frame)
                # Head center is around (128, 90)
                # Eye lines in cyan/dark:
                draw.line([(114, 96), (120, 96)], fill=(15, 20, 30, 220), width=2)
                draw.line([(136, 96), (142, 96)], fill=(15, 20, 30, 220), width=2)
                
        elif state == "listening":
            bobs = [0, 0, -1, -2, -2, -1, 0, 0]
            offset_y = bobs[i]
            frame.paste(base_img, (0, offset_y), base_img)
            # Headphone soundwave / glow pulse
            draw = ImageDraw.Draw(frame)
            glow_radius = 8 + (i % 4) * 3
            alpha = int(120 + 80 * np.sin(i * np.pi / 4))
            draw.ellipse(
                [(85 - glow_radius, 105 - glow_radius), (85 + glow_radius, 105 + glow_radius)],
                outline=(0, 212, 255, alpha), width=2
            )
            draw.ellipse(
                [(171 - glow_radius, 105 - glow_radius), (171 + glow_radius, 105 + glow_radius)],
                outline=(0, 212, 255, alpha), width=2
            )
            
        elif state == "thinking":
            bobs = [0, -1, -1, 0, 0, 1, 0, 0]
            offset_y = bobs[i]
            frame.paste(base_img, (0, offset_y), base_img)
            # Thought dots floating (1..3 dots)
            draw = ImageDraw.Draw(frame)
            dots = (i % 4)
            for d in range(dots):
                dx = 175 + d * 8
                dy = 55 - d * 6
                r = 2 + d
                draw.ellipse([(dx - r, dy - r), (dx + r, dy + r)], fill=(0, 212, 255, 200))
                
        elif state == "talking":
            # Mouth movement cycle
            bobs = [0, -1, -2, -1, 0, -2, -1, 0]
            offset_y = bobs[i]
            frame.paste(base_img, (0, offset_y), base_img)
            draw = ImageDraw.Draw(frame)
            # Mouth opening variation on odd frames:
            if i in [1, 3, 5]:
                # Draw small anime open mouth (ellipse) around (128, 106)
                draw.ellipse([(126, 105), (130, 109)], fill=(60, 30, 35, 240))
                draw.ellipse([(127, 106), (129, 108)], fill=(0, 212, 255, 180))
            # Sound ripple
            if i in [2, 4, 6]:
                draw.arc([(180, 85), (200, 105)], start=-45, end=45, fill=(0, 212, 255, 180), width=2)
                
        elif state == "happy":
            # Cheerful hop bounce
            hops = [0, -3, -6, -8, -5, -2, 0, 0]
            offset_y = hops[i]
            frame.paste(base_img, (0, offset_y), base_img)
            # Sparkles
            draw = ImageDraw.Draw(frame)
            s_alpha = int(150 + 105 * np.sin(i * np.pi / 2))
            draw.text((70, 50 + (i % 3) * 2), "✦", fill=(0, 212, 255, s_alpha))
            draw.text((185, 45 + ((i + 2) % 3) * 2), "✧", fill=(255, 255, 255, s_alpha))
            
        elif state == "surprised":
            # Jump back slightly with exclamation marks
            bobs = [-6, -4, -2, 0, 0, -1, 0, 0]
            offset_y = bobs[i]
            frame.paste(base_img, (0, offset_y), base_img)
            draw = ImageDraw.Draw(frame)
            # Exclamation marks
            draw.text((180, 40 - (i % 3)), "!", fill=(0, 212, 255, 240))
            draw.text((190, 36 - (i % 3)), "!", fill=(255, 255, 255, 220))
            
        elif state == "clicked":
            # Fast reaction squash & stretch:
            squash = [3, -5, -3, -1, 0, 0, 0, 0]
            offset_y = squash[i]
            frame.paste(base_img, (0, offset_y), base_img)
            draw = ImageDraw.Draw(frame)
            # Impact burst lines around character on frames 0, 1, 2
            if i in [0, 1, 2]:
                radius = 70 + i * 15
                for ang in [0.3, 1.2, 2.5, 3.8, 5.0]:
                    x1 = int(128 + (radius - 12) * np.cos(ang))
                    y1 = int(130 + (radius - 12) * np.sin(ang))
                    x2 = int(128 + radius * np.cos(ang))
                    y2 = int(130 + radius * np.sin(ang))
                    draw.line([(x1, y1), (x2, y2)], fill=(0, 212, 255, 230), width=2)
                    
        elif state == "sleeping":
            bobs = [0, 1, 2, 2, 1, 0, 0, 0]
            offset_y = bobs[i]
            frame.paste(base_img, (0, offset_y), base_img)
            # Floating Zzz
            draw = ImageDraw.Draw(frame)
            z_y = 65 - (i * 4)
            draw.text((170 + i * 2, z_y), "Z", fill=(0, 212, 255, int(255 * (1 - i / 10.0))))
            draw.text((182 + i * 2, z_y - 12), "z", fill=(200, 230, 255, int(220 * (1 - i / 10.0))))
            draw.text((192 + i * 2, z_y - 22), "z", fill=(255, 255, 255, int(180 * (1 - i / 10.0))))
            
        # Paste into the 2048x256 sprite sheet at x = i * FRAME_W
        sheet.paste(frame, (i * FRAME_W, 0), frame)
        
    sheet_filename = f"{state}-sheet.png"
    sheet.save(os.path.join(out_dir, sheet_filename))
    print(f"Generated {sheet_filename} ({FRAME_W * NUM_FRAMES}x{FRAME_H}, 8 frames)")

print("All 8 sprite sheets generated successfully!")
