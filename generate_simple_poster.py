import qrcode
from PIL import Image, ImageDraw, ImageFont

# A4 尺寸：210mm × 297mm，300DPI = 2480 × 3508 像素
WIDTH = 2480
HEIGHT = 3508

# 创建白色背景
img = Image.new('RGB', (WIDTH, HEIGHT), color=(255, 255, 255))
draw = ImageDraw.Draw(img)

# 字体设置
try:
    font_title = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 120)
    font_subtitle = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 72)
except:
    font_title = ImageFont.load_default()
    font_subtitle = ImageFont.load_default()

# ===== 顶部标题 =====
title_text = "党支部义务电脑维修队"
title_bbox = draw.textbbox((0, 0), title_text, font=font_title)
title_width = title_bbox[2] - title_bbox[0]
title_x = (WIDTH - title_width) // 2
draw.text((title_x, 400), title_text, font=font_title, fill=(30, 58, 95))

# 副标题
subtitle_text = "—— 一轮面试登记 ——"
sub_bbox = draw.textbbox((0, 0), subtitle_text, font=font_subtitle)
sub_width = sub_bbox[2] - sub_bbox[0]
sub_x = (WIDTH - sub_width) // 2
draw.text((sub_x, 600), subtitle_text, font=font_subtitle, fill=(100, 116, 139))

# ===== 二维码 =====
qr_size = 800
qr_x = (WIDTH - qr_size) // 2
qr_y = 1000

# 生成二维码
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=15,
    border=4,
)
qr.add_data("https://meet.guido.cn")
qr.make(fit=True)
qr_img = qr.make_image(fill_color=(30, 58, 95), back_color=(255, 255, 255))
qr_img = qr_img.resize((qr_size, qr_size))
img.paste(qr_img, (qr_x, qr_y))

# 二维码提示
try:
    font_hint = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 48)
except:
    font_hint = ImageFont.load_default()

hint_text = "微信扫码 · 填写信息 · 取号面试"
hint_bbox = draw.textbbox((0, 0), hint_text, font=font_hint)
hint_width = hint_bbox[2] - hint_bbox[0]
draw.text(((WIDTH - hint_width) // 2, qr_y + qr_size + 80), hint_text, font=font_hint, fill=(100, 116, 139))

# 保存图片
output_path = r"E:\github\meet\meet\面试登记二维码_A4.png"
img.save(output_path, dpi=(300, 300))
print(f"简洁版海报已生成：{output_path}")
