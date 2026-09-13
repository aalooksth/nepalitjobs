"""
Asset generation script for Nepal IT Jobs
Generates:
1. favicon.ico (16x16, 32x32, 48x48)
2. og-image.png (1200x630) social share card
"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def create_favicon():
    sizes = [(16, 16), (32, 32), (48, 48)]
    images = []
    
    for w, h in sizes:
        img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Background rounded rect
        draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=max(2, w // 4), fill=(11, 13, 18, 255))
        
        # Inner gradient-like badge
        margin = max(1, w // 8)
        draw.rounded_rectangle([margin, margin, w - 1 - margin, h - 1 - margin], radius=max(1, w // 6), fill=(232, 38, 74, 255))
        
        # Diagonal violet gradient effect
        for i in range(margin, w - margin):
            for j in range(margin, h - margin):
                ratio = (i + j) / (2 * w)
                r = int(232 * (1 - ratio) + 124 * ratio)
                g = int(38 * (1 - ratio) + 58 * ratio)
                b = int(74 * (1 - ratio) + 237 * ratio)
                img.putpixel((i, j), (r, g, b, 255))
                
        # Draw "NP" text if size >= 32
        if w >= 32:
            try:
                font = ImageFont.truetype("arial.ttf", size=int(w * 0.42))
            except Exception:
                font = ImageFont.load_default()
            draw = ImageDraw.Draw(img)
            bbox = draw.textbbox((0, 0), "NP", font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            draw.text(((w - tw) // 2, (h - th) // 2 - 1), "NP", fill=(255, 255, 255, 255), font=font)
            
        images.append(img)
        
    ico_path = os.path.join(BASE_DIR, "favicon.ico")
    images[1].save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[images[0], images[2]])
    print(f"Generated {ico_path}")

def create_og_image():
    W, H = 1200, 630
    img = Image.new("RGBA", (W, H), (11, 13, 18, 255))
    draw = ImageDraw.Draw(img)
    
    # Background subtle radial gradients / glows
    for r in range(400, 0, -4):
        alpha = int(35 * (1 - (r / 400)))
        draw.ellipse([800 - r, 120 - r, 800 + r, 120 + r], fill=(124, 58, 237, alpha))
        draw.ellipse([250 - r, 450 - r, 250 + r, 450 + r], fill=(232, 38, 74, alpha))
        
    # Border stroke
    draw.rounded_rectangle([20, 20, W - 20, H - 20], radius=24, outline=(38, 42, 54, 255), width=2)
    
    # Try loading fonts
    try:
        font_eyebrow = ImageFont.truetype("arial.ttf", 20)
        font_title = ImageFont.truetype("arialbd.ttf", 64)
        font_subtitle = ImageFont.truetype("arial.ttf", 28)
        font_stat_num = ImageFont.truetype("arialbd.ttf", 38)
        font_stat_lbl = ImageFont.truetype("arial.ttf", 18)
        font_badge = ImageFont.truetype("arialbd.ttf", 18)
        font_footer = ImageFont.truetype("arial.ttf", 20)
    except Exception:
        font_eyebrow = font_title = font_subtitle = font_stat_num = font_stat_lbl = font_badge = font_footer = ImageFont.load_default()
        
    # Eyebrow
    draw.rounded_rectangle([70, 70, 480, 110], radius=20, fill=(232, 38, 74, 40), outline=(232, 38, 74, 120), width=1)
    draw.text((90, 80), "LIVE TECH PORTAL & IT DIRECTORY", font=font_eyebrow, fill=(255, 100, 130, 255))
    
    # Title
    draw.text((70, 135), "Nepal IT Jobs", font=font_title, fill=(255, 255, 255, 255))
    
    # Subtitle
    draw.text((70, 220), "Real-time vacancies scraped directly from company career portals across Nepal.", font=font_subtitle, fill=(200, 205, 218, 255))
    draw.text((70, 260), "Interactive OpenStreetMap · 37+ Verified Tech Firms · Zero Recruiter Spam.", font=font_subtitle, fill=(150, 155, 175, 255))
    
    # 3 Stat Cards
    stat_cards = [
        ("Live Vacancies", "Aggregated Daily", (124, 58, 237)),
        ("37+ IT Firms", "Kathmandu · Pokhara · Beyond", (232, 38, 74)),
        ("Direct ATS", "BambooHR · Workable · Recruitee", (16, 185, 129))
    ]
    
    x = 70
    for title, subtitle, color in stat_cards:
        draw.rounded_rectangle([x, 325, x + 330, 445], radius=16, fill=(18, 22, 31, 255), outline=(42, 47, 62, 255), width=1)
        # Left color bar
        draw.rounded_rectangle([x + 16, 345, x + 22, 425], radius=3, fill=color)
        draw.text((x + 36, 350), title, font=font_stat_num, fill=(255, 255, 255, 255))
        draw.text((x + 36, 402), subtitle, font=font_stat_lbl, fill=(156, 163, 175, 255))
        x += 360
        
    # Feature Pills
    pills = ["Software Engineering", "QA / Automation", "DevOps & Cloud", "AI / ML", "UI/UX Design", "Data Analytics"]
    px = 70
    for p in pills:
        draw.rounded_rectangle([px, 475, px + len(p)*11 + 24, 515], radius=20, fill=(28, 33, 46, 255), outline=(50, 56, 75, 255), width=1)
        draw.text((px + 14, 485), p, font=font_badge, fill=(209, 213, 219, 255))
        px += len(p)*11 + 34
        if px > 1100:
            break
            
    # Footer bar
    draw.line([(70, 545), (W - 70, 545)], fill=(38, 42, 54, 255), width=1)
    draw.text((70, 565), "Made with ❤️ in 🇳🇵 by Alok — hello@aloks.com.np", font=font_footer, fill=(156, 163, 175, 255))
    draw.text((820, 565), "nepalitjobs.aloks.com.np", font=font_footer, fill=(232, 38, 74, 255))
    
    out_path = os.path.join(BASE_DIR, "og-image.png")
    img.save(out_path, format="PNG")
    print(f"Generated {out_path}")

if __name__ == "__main__":
    create_favicon()
    create_og_image()
