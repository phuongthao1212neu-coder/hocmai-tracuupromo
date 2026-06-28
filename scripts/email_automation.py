"""
HOCMAI Email Automation Script
===============================
Gửi mail tự động thông báo chương trình ưu đãi.

Flow:
  --mode notify (22:30): Đọc sheet, kiểm tra NGÀY MAI → Telegram cho chị duyệt.
  --mode send   (00:25): Đọc sheet, kiểm tra HÔM NAY → gửi mail nếu confirmed.
                         (00h30 là giờ gửi thực tế, script chạy sớm 5 phút)

Xác nhận:
  - Telegram: Chị reply "GỬI MAIL" → Hermes chạy confirm_email.py
  - Sheet: Cột H = YES (dự phòng)

Mail gửi lúc 00h30 ngày mùng 1 hoặc ngày bắt đầu ngày vàng.
"""

import os
import sys
import json
import re
import smtplib
import urllib.request
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================

SCRIPT_DIR = Path(__file__).parent
STATE_FILE = SCRIPT_DIR / "email_state.json"
ENV_FILE = SCRIPT_DIR / ".env"

def load_env():
    if ENV_FILE.exists():
        with open(ENV_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    os.environ[key.strip()] = val.strip()
load_env()

APPS_SCRIPT_GOLDEN_URL = os.environ.get("HOCMAI_GOLDEN_SCRIPT_URL", "")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = "thaonp@hocmai.vn"
SENDER_PASSWORD = os.environ.get("HOCMAI_EMAIL_APP_PASSWORD", "")
TELEGRAM_TARGET = "telegram:Nguyen Thao (dm)"


# ============================================================
# TIME HELPERS (GMT+7)
# ============================================================

def now_gmt7():
    return datetime.utcnow() + timedelta(hours=7)

def today_gmt7():
    return now_gmt7().date()

def tomorrow_gmt7():
    return today_gmt7() + timedelta(days=1)


# ============================================================
# FETCH GOLDEN SHEET
# ============================================================

def fetch_golden_sheet():
    if not APPS_SCRIPT_GOLDEN_URL:
        print("[ERROR] Chưa có APPS_SCRIPT_GOLDEN_URL.")
        return []
    try:
        with urllib.request.urlopen(APPS_SCRIPT_GOLDEN_URL, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        if isinstance(data, dict) and 'error' in data:
            print(f"[ERROR] Apps Script: {data['error']}")
            return []
        # Skip header row
        result = []
        for row in data:
            if isinstance(row, dict):
                doi_tuong = row.get('doiTuong', '')
                ngay_bd = str(row.get('ngayBatDau', '')).lower()
                # Skip dòng header
                if 'đối tượng' in doi_tuong.lower():
                    continue
                if ngay_bd in ['bắt đầu', 'header', '']:
                    # Có thể là header nếu ngayBatDau là text
                    if 'nội dung' in str(row.get('noiDungDauThang', '')).lower():
                        continue
                result.append(row)
        return result
    except Exception as e:
        print(f"[ERROR] Fetch Apps Script: {e}")
        return []


# ============================================================
# PARSE DATE & TRIGGERS
# ============================================================

def parse_date_cell(date_str):
    """Parse 1 ô ngày: "28/06", "28/06/2026", hoặc "Wed Jun 03 2026..." từ Apps Script"""
    if not date_str:
        return None
    d = date_str.strip()
    current_year = today_gmt7().year
    
    # Format từ Apps Script: "Wed Jun 03 2026 00:00:00 GMT+0700 (...)"
    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    d_lower = d.lower()
    for abbr, m in month_map.items():
        if abbr in d_lower:
            import re
            match = re.search(rf'{abbr}\\s+(\\d{{1,2}})\\s+(\\d{{4}})', d_lower)
            if match:
                day = int(match.group(1))
                year = int(match.group(2))
                return datetime(year, m, day).date()
    
    # Format "dd/mm/yyyy" hoặc "dd/mm"
    for fmt in ['%d/%m/%Y', '%d/%m']:
        try:
            dt = datetime.strptime(d, fmt)
            if dt.year == 1900:
                dt = dt.replace(year=current_year)
            return dt.date()
        except:
            pass
    return None


def check_triggers(target_date, rows):
    """
    Duyệt sheet, tìm mail cần gửi cho target_date.
    target_date: ngày cần kiểm tra (today cho mode send, tomorrow cho mode notify)
    """
    target_str = target_date.strftime('%d/%m/%Y')
    month_year = target_date.strftime('%m/%Y')
    is_first = (target_date.day == 1)

    notifications = []
    has_golden = False

    for row in rows:
        doi_tuong = row.get('doiTuong', '')
        list_email = row.get('listEmail', '')
        start_date = parse_date_cell(row.get('ngayBatDau', ''))
        end_date = parse_date_cell(row.get('ngayKetThuc', ''))

        # === Mail đầu tháng (mùng 1) ===
        if is_first and row.get('noiDungDauThang', ''):
            subject, body = parse_email_content(row['noiDungDauThang'], doi_tuong, target_date, start_date, end_date)
            notifications.append({
                'doi_tuong': doi_tuong,
                'list_email': list_email,
                'subject': subject,
                'body': body,
                'mail_type': 'MAIL MỚI (đầu tháng)'
            })

        # === Mail ngày vàng (chỉ gửi 1 lần, đúng ngày bắt đầu) ===
        if start_date and target_date == start_date and row.get('noiDungNgayVang', ''):
            has_golden = True
            # Ngày vàng reply mail đầu tháng → Gmail tự thêm "Re:" vào subject gốc
            subject, body = parse_email_content(row['noiDungNgayVang'], doi_tuong, target_date, start_date, end_date, default_subject="")
            notifications.append({
                'doi_tuong': doi_tuong,
                'list_email': list_email,
                'subject': subject,
                'body': body,
                'mail_type': 'REPLY (ngày vàng)'
            })

    return {
        'is_first_of_month': is_first,
        'is_golden': has_golden,
        'notifications': notifications
    }


# ============================================================
# PARSE EMAIL CONTENT
# ============================================================

def parse_email_content(raw, doi_tuong, target_date, start_date, end_date, default_subject=""):
    """
    Parse nội dung email, thay biến ngày.
    Hỗ trợ 2 format:
      "Title email: <title>\n\nNội dung:\n<body>"
      "Nội dung:\n<body>"  (dùng default_subject)
    Biến: DD/MM/YYYY, {{NGAY_BAT_DAU}}, {{NGAY_KET_THUC}}, {{DOI_TUONG}}, mm/yyyy
    """
    content = raw.strip()
    subject = default_subject
    body = content

    lines = content.split('\n')
    
    # Tìm "Title email:" ở đầu
    if lines and lines[0].lower().startswith('title email:'):
        subject = lines[0][len('title email:'):].strip().strip('"').strip("'")
        body_start = 1
        for i, line in enumerate(lines[1:], 1):
            if line.strip().lower() == 'nội dung:':
                body_start = i + 1
                break
        body = '\n'.join(lines[body_start:]).strip()
    elif lines and lines[0].strip().lower() == 'nội dung:':
        # Format: "Nội dung:\n<body>"
        body = '\n'.join(lines[1:]).strip()
    elif lines and 'nội dung:' in lines[0].lower():
        # "Nội dung: <body>" trên cùng 1 dòng
        body = lines[0][lines[0].lower().find('nội dung:') + len('nội dung:'):].strip()
        if len(lines) > 1:
            body += '\n' + '\n'.join(lines[1:])

    if not subject:
        subject = f"[HOCMAI] Thông báo chương trình ưu đãi — {doi_tuong}"

    # Thay biến ngày
    month_year = target_date.strftime('%m/%Y')
    start_str = start_date.strftime('%d/%m/%Y') if start_date else ''
    end_str = end_date.strftime('%d/%m/%Y') if end_date else ''
    start_short = start_date.strftime('%d/%m') if start_date else ''
    end_short = end_date.strftime('%d/%m') if end_date else ''

    subject = subject.replace('mm/yyyy', month_year).replace('"mm/yyyy"', month_year)
    subject = subject.replace('"mm"', str(target_date.month)).replace('"yyyy"', str(target_date.year))

    # Body placeholders — thay range trước, rồi mới thay đơn lẻ
    body = body.replace('DD/MM/YYYY - DD/MM/YYYY', f'{start_str} - {end_str}')
    body = body.replace('DD/MM - DD/MM', f'{start_short} - {end_short}')
    body = body.replace('DD/MM/YYYY', start_str)
    body = body.replace('DD/MM', start_short)
    body = body.replace('{{NGAY_BAT_DAU}}', start_str)
    body = body.replace('{{NGAY_KET_THUC}}', end_str)
    body = body.replace('{{DOI_TUONG}}', doi_tuong)
    body = body.replace('{{THANG}}', month_year)
    body = body.replace('mm/yyyy', month_year)
    body = body.replace('MM/YYYY', month_year)

    return subject, body


# ============================================================
# EMAIL SENDING
# ============================================================

def send_email(recipients, subject, body, in_reply_to=None):
    if not SENDER_PASSWORD:
        print("[ERROR] Chưa có HOCMAI_EMAIL_APP_PASSWORD.")
        return None
    if not recipients:
        print("[ERROR] Không có người nhận.")
        return None

    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = ', '.join(recipients)
    msg['Subject'] = subject
    if in_reply_to:
        msg['In-Reply-To'] = in_reply_to
        msg['References'] = in_reply_to
    # Convert plain text → HTML: xuống dòng, link
    html_body = body.replace('\n', '<br>')
    html_body = f"<html><body style='font-family:Arial,sans-serif;font-size:14px;color:#333'>{html_body}</body></html>"
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=30) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        message_id = msg.get('Message-ID', f"<{datetime.now().timestamp()}@hocmai.vn>")
        print(f"[OK] Đã gửi mail tới {len(recipients)} người nhận.")
        return str(message_id)
    except Exception as e:
        print(f"[ERROR] Gửi mail thất bại: {e}")
        return None


# ============================================================
# TELEGRAM NOTIFICATION
# ============================================================

def notify_telegram(message):
    notify_file = SCRIPT_DIR / "telegram_notify.txt"
    with open(notify_file, 'w', encoding='utf-8') as f:
        f.write(message)
    print(f"[TELEGRAM] {message}")


# ============================================================
# STATE MANAGEMENT
# ============================================================

def load_state():
    if STATE_FILE.exists():
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_state(state):
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


# ============================================================
# MODE: NOTIFY (22:30)
# ============================================================

def mode_notify():
    """Kiểm tra NGÀY MAI → Telegram thông báo."""
    tomorrow = tomorrow_gmt7()
    tomorrow_str = tomorrow.strftime('%d/%m/%Y')

    rows = fetch_golden_sheet()
    if not rows:
        notify_telegram("❌ [HOCMAI Email] LỖI: Không đọc được sheet.")
        return

    trigger = check_triggers(tomorrow, rows)
    if not trigger['is_first_of_month'] and not trigger['is_golden']:
        print(f"[INFO] Ngày mai {tomorrow_str} không trigger. Không làm gì.")
        return

    notifications = trigger['notifications']
    if not notifications:
        print("[INFO] Có trigger nhưng không có nội dung mail.")
        return

    # Soạn Telegram
    labels = []
    if trigger['is_first_of_month']:
        labels.append("Mùng 1")
    if trigger['is_golden']:
        labels.append("Ngày vàng")

    msg = [f"📧 [HOCMAI] THÔNG BÁO GỬI MAIL — {tomorrow_str}"]
    msg.append(f"⏰ Sẽ gửi lúc: 00h30 ngày {tomorrow_str}")
    msg.append(f"📅 Loại: {' + '.join(labels)}")
    msg.append("")

    for i, n in enumerate(notifications, 1):
        msg.append(f"--- Mail {i} ---")
        msg.append(f"👥 {n['doi_tuong']}")
        msg.append(f"📧 Người nhận: {n['list_email'][:120]}")
        msg.append(f"📌 {n['mail_type']}")
        msg.append(f"📝 Tiêu đề: {n['subject']}")
        msg.append(f"📄 Nội dung:\n{n['body'][:500]}")
        msg.append("")

    msg.append("---")
    msg.append("✅ XÁC NHẬN GỬI: Reply 'GỬI MAIL' trên Telegram")
    msg.append("❌ HỦY: Không reply hoặc reply 'HỦY'")
    msg.append("⏰ Hạn chót: 00h25")

    telegram_msg = '\n'.join(msg)
    notify_telegram(telegram_msg)

    # Lưu state
    state = load_state()
    state['pending'] = {
        'date': str(tomorrow),
        'is_first_of_month': trigger['is_first_of_month'],
        'is_golden': trigger['is_golden'],
        'notifications': notifications,
        'notified_at': datetime.now().isoformat()
    }
    save_state(state)
    print(f"[DONE] Đã thông báo {len(notifications)} mail.")


# ============================================================
# MODE: SEND (00:25)
# ============================================================

def mode_send():
    """Kiểm tra HÔM NAY (đã sang ngày mới) → gửi mail nếu confirmed."""
    today = today_gmt7()
    today_str = today.strftime('%d/%m/%Y')

    state = load_state()
    pending = state.get('pending')

    if not pending:
        print("[INFO] Không có mail pending.")
        return

    # Chỉ kiểm tra Telegram confirm
    telegram_confirmed = pending.get('confirmed', False)
    
    if not telegram_confirmed:
        print("[INFO] Chị chưa confirm qua Telegram → HỦY toàn bộ, không gửi.")
        state.pop('pending', None)
        save_state(state)
        notify_telegram("❌ [HOCMAI] Chưa có xác nhận GỬI MAIL qua Telegram → ĐÃ HỦY.")
        return
    
    notifications = pending.get('notifications', [])
    first_month_msg_id = state.get('first_month_message_id')
    sent_count = 0

    for n in notifications:
        doi_tuong = n['doi_tuong']
        recipients = [e.strip() for e in n['list_email'].replace('\n', ',').split(',') if e.strip()]
        is_new = ('đầu tháng' in n.get('mail_type', ''))

        if is_new:
            msg_id = send_email(recipients, n['subject'], n['body'])
            if msg_id:
                state['first_month_message_id'] = msg_id
                sent_count += 1
        else:
            if first_month_msg_id:
                msg_id = send_email(recipients, n['subject'], n['body'], in_reply_to=first_month_msg_id)
            else:
                msg_id = send_email(recipients, n['subject'], n['body'])
            if msg_id:
                sent_count += 1

    state.pop('pending', None)
    save_state(state)

    result = f"📊 [HOCMAI] KẾT QUẢ GỬI MAIL:\n✅ Đã gửi: {sent_count}/{len(notifications)}"
    notify_telegram(result)
    print(result)


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    args = sys.argv[1:]
    mode = 'notify'
    if '--mode' in args:
        idx = args.index('--mode')
        if idx + 1 < len(args):
            mode = args[idx + 1]
    elif args:
        mode = args[0]

    print(f"[INFO] Mode: {mode}")
    print(f"[INFO] Hôm nay (GMT+7): {today_gmt7()}")
    print(f"[INFO] Ngày mai (GMT+7): {tomorrow_gmt7()}")

    if mode == 'notify':
        mode_notify()
    elif mode == 'send':
        mode_send()
    else:
        print("Usage: python email_automation.py [notify|send]")
        sys.exit(1)
