import qrcode
from PIL import Image, ImageDraw, ImageFont

# A4 尺寸：210mm × 297mm，300DPI = 2480 × 3508 像素
WIDTH = 2480
HEIGHT = 3508

# 创建白色背景
img = Image.new('RGB', (WIDTH, HEIGHT), color=(255, 255, 255))
draw = ImageDraw.Draw(img)

# 顶部和底部装饰条
draw.rectangle([(0, 0), (WIDTH, 15)], fill=(6, 182, 212))
draw.rectangle([(0, HEIGHT - 15), (WIDTH, HEIGHT)], fill=(59, 130, 246))

# 字体设置
try:
    font_title = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 95)
    font_subtitle = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 52)
    font_hint = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 40)
except:
    font_title = ImageFont.load_default()
    font_subtitle = ImageFont.load_default()
    font_hint = ImageFont.load_default()

# ===== 内容整体垂直居中 =====
# 计算总高度：标题(200) + 间距(50) + 副标题(80) + 间距(80) + 二维码(1200) + 间距(60) + 提示(60)
content_height = 200 + 50 + 80 + 80 + 1200 + 60 + 60
start_y = (HEIGHT - content_height) // 2

# ===== 加载logo =====
logo_path = r"E:\github\meet\meet\client\public\logo.webp"
try:
    logo = Image.open(logo_path).convert("RGBA")
    logo_size = 150
    logo = logo.resize((logo_size, logo_size))
    title_text = "党支部义务电脑维修队"
    title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
    title_width = title_bbox[2] - title_bbox[0]
    total_width = title_width + 25 + logo_size
    start_x = (WIDTH - total_width) // 2
    title_x = start_x + logo_size + 25
    logo_x = start_x
    logo_y = start_y
    img.paste(logo, (logo_x, logo_y), logo)
except Exception as e:
    print(f"Logo加载失败：{e}")
    title_text = "党支部义务电脑维修队"
    title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (WIDTH - title_width) // 2

# 标题
draw.text((title_x, start_y + 20), title_text, font=font_title, fill=(30, 58, 95))

# 副标题
subtitle_y = start_y + 200
subtitle_text = "一 轮 面 试 登 记"
sub_bbox = draw.textbbox((0, 0), subtitle_text, font=font_subtitle)
sub_width = sub_bbox[2] - sub_bbox[0]
sub_x = (WIDTH - sub_width) // 2
draw.text((sub_x, subtitle_y), subtitle_text, font=font_subtitle, fill=(100, 116, 139))

# ===== 二维码 =====
qr_size = 1200
qr_x = (WIDTH - qr_size) // 2
qr_y = subtitle_y + 80

# 白色卡片背景
card_margin = 40
draw.rounded_rectangle(
    [(qr_x - card_margin, qr_y - card_margin), 
     (qr_x + qr_size + card_margin, qr_y + qr_size + card_margin)],
    radius=20,
    fill=(255, 255, 255),
    outline=(6, 182, 212),
    width=3
)

# 生成二维码
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=25,
    border=2,
)
qr.add_data("https://meet.guido.cn")
qr.make(fit=True)
qr_img = qr.make_image(fill_color=(30, 58, 95), back_color=(255, 255, 255))
qr_img = qr_img.resize((qr_size, qr_size))
img.paste(qr_img, (qr_x, qr_y))

# ===== 底部提示 =====
hint_y = qr_y + qr_size + card_margin + 50

hint_text = "微信扫一扫 · 填写信息 · 取号面试"
hint_bbox = draw.textbbox((0, 0), hint_text, font=font_hint)
hint_width = hint_bbox[2] - hint_bbox[0]
draw.text(((WIDTH - hint_width) // 2, hint_y), hint_text, font=font_hint, fill=(100, 116, 139))

# 底部装饰
draw.rectangle([(WIDTH//2 - 120, hint_y + 60), (WIDTH//2 + 120, hint_y + 63)], fill=(6, 182, 212))

# 保存图片
output_path = r"E:\github\meet\meet\面试登记二维码_A4_垂直居中版.png"
img.save(output_path, dpi=(300, 300))
print(f"垂直居中版海报已生成：{output_path}")
print(f"内容起始Y坐标：{start_y}（上下留白均匀）")
print(f"二维码尺寸：{qr_size} × {qr_size} 像素")
