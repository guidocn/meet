import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# A4 尺寸：210mm × 297mm，300DPI = 2480 × 3508 像素
WIDTH = 2480
HEIGHT = 3508

# 创建渐变背景（浅蓝 -> 深蓝）
img = Image.new('RGB', (WIDTH, HEIGHT), color=(240, 248, 255))
draw = ImageDraw.Draw(img)

# 绘制渐变背景
for y in range(HEIGHT):
    ratio = y / HEIGHT
    r = int(240 - (240 - 230) * ratio)
    g = int(248 - (248 - 240) * ratio)
    b = int(255 - (255 - 255) * ratio)
    draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

# 顶部和底部装饰条
draw.rectangle([(0, 0), (WIDTH, 15)], fill=(6, 182, 212))
draw.rectangle([(0, HEIGHT - 15), (WIDTH, HEIGHT)], fill=(59, 130, 246))

# 字体设置
try:
    font_title = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 110)
    font_subtitle = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 60)
    font_hint = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 44)
except:
    font_title = ImageFont.load_default()
    font_subtitle = ImageFont.load_default()
    font_hint = ImageFont.load_default()

# ===== 顶部装饰线 =====
draw.rectangle([(WIDTH//2 - 200, 280), (WIDTH//2 + 200, 284)], fill=(6, 182, 212))

# ===== 标题 =====
title_text = "党支部义务电脑维修队"
title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
title_width = title_bbox[2] - title_bbox[0]
title_x = (WIDTH - title_width) // 2
draw.text((title_x, 350), title_text, font=font_title, fill=(30, 58, 95))

# 副标题
subtitle_text = "一 轮 面 试 登 记"
sub_bbox = draw.textbbox((0, 0), subtitle_text, font=font_subtitle)
sub_width = sub_bbox[2] - sub_bbox[0]
sub_x = (WIDTH - sub_width) // 2
draw.text((sub_x, 520), subtitle_text, font=font_subtitle, fill=(100, 116, 139))

# ===== 二维码卡片背景 =====
qr_size = 1000
qr_x = (WIDTH - qr_size) // 2
qr_y = 800

# 白色卡片（带阴影效果）
card_margin = 60
draw.rounded_rectangle(
    [(qr_x - card_margin, qr_y - card_margin), 
     (qr_x + qr_size + card_margin, qr_y + qr_size + card_margin)],
    radius=30,
    fill=(255, 255, 255),
    outline=(6, 182, 212),
    width=4
)

# 生成二维码
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=20,
    border=2,
)
qr.add_data("https://meet.guido.cn")
qr.make(fit=True)
qr_img = qr.make_image(fill_color=(30, 58, 95), back_color=(255, 255, 255))
qr_img = qr_img.resize((qr_size, qr_size))
img.paste(qr_img, (qr_x, qr_y))

# ===== 底部提示 =====
hint_text = "微信扫一扫 · 填写信息 · 取号面试"
hint_bbox = draw.textbbox((0, 0), hint_text, font=font_hint)
hint_width = hint_bbox[2] - hint_bbox[0]
draw.text(((WIDTH - hint_width) // 2, qr_y + qr_size + card_margin + 60), 
          hint_text, font=font_hint, fill=(100, 116, 139))

# 底部装饰
draw.rectangle([(WIDTH//2 - 150, HEIGHT - 250), (WIDTH//2 + 150, HEIGHT - 246)], fill=(6, 182, 212))

# 保存图片
output_path = r"E:\github\meet\meet\面试登记二维码_A4_精美版.png"
img.save(output_path, dpi=(300, 300))
print(f"精美版海报已生成：{output_path}")
print(f"二维码尺寸：{qr_size} × {qr_size} 像素")
