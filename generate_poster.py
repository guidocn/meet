import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

# A4 尺寸：210mm × 297mm，300DPI = 2480 × 3508 像素
WIDTH = 2480
HEIGHT = 3508

# 创建深色渐变背景
img = Image.new('RGB', (WIDTH, HEIGHT), color=(15, 23, 42))
draw = ImageDraw.Draw(img)

# 绘制渐变背景（从上到下：深蓝 -> 浅蓝 -> 深蓝）
for y in range(HEIGHT):
    ratio = y / HEIGHT
    if ratio < 0.5:
        r = int(15 + (30 - 15) * ratio * 2)
        g = int(23 + (58 - 23) * ratio * 2)
        b = int(42 + (95 - 42) * ratio * 2)
    else:
        r = int(30 - (30 - 15) * (ratio - 0.5) * 2)
        g = int(58 - (58 - 23) * (ratio - 0.5) * 2)
        b = int(95 - (95 - 42) * (ratio - 0.5) * 2)
    draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

# 顶部和底部装饰条
draw.rectangle([(0, 0), (WIDTH, 10)], fill=(6, 182, 212))
draw.rectangle([(0, HEIGHT - 10), (WIDTH, HEIGHT)], fill=(139, 92, 246))

# 字体设置
try:
    font_large = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 80)
    font_medium = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 48)
    font_small = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 36)
    font_tiny = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 28)
except:
    font_large = ImageFont.load_default()
    font_medium = ImageFont.load_default()
    font_small = ImageFont.load_default()
    font_tiny = ImageFont.load_default()

# ===== 顶部：维修队名称 =====
title_text = "党支部义务电脑维修队"
title_bbox = draw.textbbox((0, 0), title_text, font=font_large)
title_width = title_bbox[2] - title_bbox[0]
title_x = (WIDTH - title_width) // 2
draw.text((title_x, 150), title_text, font=font_large, fill=(255, 255, 255))

# 副标题
subtitle_text = "—— 成立23年 · 技术传承 · 志愿服务 ——"
sub_bbox = draw.textbbox((0, 0), subtitle_text, font=font_small)
sub_width = sub_bbox[2] - sub_bbox[0]
sub_x = (WIDTH - sub_width) // 2
draw.text((sub_x, 260), subtitle_text, font=font_small, fill=(148, 163, 184))

# ===== 简介区域 =====
intro_y = 380
draw.rounded_rectangle([(150, intro_y), (WIDTH - 150, intro_y + 280)], 
                       radius=20, fill=(255, 255, 255, 20), outline=(6, 182, 212, 100), width=2)

intro_title = "📋 关于我们"
draw.text((190, intro_y + 30), intro_title, font=font_medium, fill=(6, 182, 212))

intro_lines = [
    "党支部义务电脑维修队成立于2001年，是学校老牌志愿服务组织。",
    '我们秉承"认真做事，大度做人"的理念，为全校师生提供免费',
    "电脑维修服务。队内有技术培训、团队活动、学时认定，",
    "还有入团入党名额和奖学金名额等你拿！"
]

for i, line in enumerate(intro_lines):
    draw.text((190, intro_y + 100 + i * 45), line, font=font_small, fill=(203, 213, 225))

# ===== 部门介绍（三列）=====
dept_y = 720
dept_width = (WIDTH - 300 - 60) // 3
dept_height = 200

depts = [
    ("🔧 技术部", "电脑硬件维修\n系统安装 · 软件调试\n网络维护"),
    ("📢 宣传部", "活动策划\n公众号运营 · 海报设计\n摄影摄像"),
    ("🤝 外联部", "对外联络\n赞助洽谈 · 活动组织\n资源对接")
]

for i, (name, desc) in enumerate(depts):
    x = 150 + i * (dept_width + 30)
    draw.rounded_rectangle([(x, dept_y), (x + dept_width, dept_y + dept_height)],
                           radius=15, fill=(255, 255, 255, 15), outline=(255, 255, 255, 50), width=1)
    draw.text((x + 30, dept_y + 25), name, font=font_small, fill=(251, 191, 36))
    for j, line in enumerate(desc.split('\n')):
        draw.text((x + 30, dept_y + 85 + j * 38), line, font=font_tiny, fill=(148, 163, 184))

# ===== 福利标签 =====
benefit_y = 980
benefits = ["🎓 技术培训", "📚 学时认定", "🏆 奖学金名额", "🚩 入团入党名额", "👥 团队氛围好"]

for i, benefit in enumerate(benefits):
    bbox = draw.textbbox((0, 0), benefit, font=font_tiny)
    bw = bbox[2] - bbox[0] + 40
    bh = 50
    total_width = sum(draw.textbbox((0,0), b, font=font_tiny)[2] - draw.textbbox((0,0), b, font=font_tiny)[0] + 40 for b in benefits) + 30 * (len(benefits) - 1)
    start_x = (WIDTH - total_width) // 2
    
    bx = start_x + sum(draw.textbbox((0,0), benefits[k], font=font_tiny)[2] - draw.textbbox((0,0), benefits[k], font=font_tiny)[0] + 70 for k in range(i))
    draw.rounded_rectangle([(bx, benefit_y), (bx + bw, benefit_y + bh)], radius=25,
                           fill=(6, 182, 212, 30), outline=(6, 182, 212, 100), width=1)
    draw.text((bx + 20, benefit_y + 10), benefit, font=font_tiny, fill=(6, 182, 212))

# ===== 二维码区域 =====
qr_size = 500
qr_x = (WIDTH - qr_size) // 2
qr_y = 1120

# 白色卡片背景
draw.rounded_rectangle([(qr_x - 60, qr_y - 80), (qr_x + qr_size + 60, qr_y + qr_size + 140)],
                       radius=30, fill=(255, 255, 255))

# 二维码标题
qr_title = "📱 扫码进行信息签到"
qr_title_bbox = draw.textbbox((0, 0), qr_title, font=font_medium)
qr_title_width = qr_title_bbox[2] - qr_title_bbox[0]
draw.text(((WIDTH - qr_title_width) // 2, qr_y - 50), qr_title, font=font_medium, fill=(30, 58, 95))

# 生成二维码
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=10,
    border=4,
)
qr.add_data("https://meet.guido.cn")
qr.make(fit=True)
qr_img = qr.make_image(fill_color=(30, 58, 95), back_color=(255, 255, 255))
qr_img = qr_img.resize((qr_size, qr_size))
img.paste(qr_img, (qr_x, qr_y))

# 二维码提示
qr_hint = "微信扫一扫 · 填写信息 · 取号面试"
hint_bbox = draw.textbbox((0, 0), qr_hint, font=font_small)
hint_width = hint_bbox[2] - hint_bbox[0]
draw.text(((WIDTH - hint_width) // 2, qr_y + qr_size + 30), qr_hint, font=font_small, fill=(100, 116, 139))

# ===== 底部提示 =====
footer_y = HEIGHT - 200
footer_text = "💡 有问题请现场找黄色马甲或带工作证的师兄师姐"
footer_bbox = draw.textbbox((0, 0), footer_text, font=font_small)
footer_width = footer_bbox[2] - footer_bbox[0]
draw.text(((WIDTH - footer_width) // 2, footer_y), footer_text, font=font_small, fill=(251, 191, 36))

# 底部版权
copyright_text = "此系统由义务电脑维修队开发"
copy_bbox = draw.textbbox((0, 0), copyright_text, font=font_tiny)
copy_width = copy_bbox[2] - copy_bbox[0]
draw.text(((WIDTH - copy_width) // 2, footer_y + 60), copyright_text, font=font_tiny, fill=(100, 116, 139))

# 保存图片
output_path = r"E:\github\meet\meet\签到海报_A4.png"
img.save(output_path, dpi=(300, 300))
print(f"海报已生成：{output_path}")
print(f"尺寸：{WIDTH} × {HEIGHT} 像素（A4 300DPI）")
