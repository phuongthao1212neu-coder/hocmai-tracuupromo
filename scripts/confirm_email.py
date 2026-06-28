"""
confirm_email.py
================
Script được Hermes gọi khi chị Thảo xác nhận gửi mail qua Telegram.
Set flag confirmed trong state file để job 23:55 biết mà gửi.

Usage: python confirm_email.py
"""
import json
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent
STATE_FILE = SCRIPT_DIR / "email_state.json"

if not STATE_FILE.exists():
    print("❌ Chưa có email nào đang chờ gửi (không tìm thấy state file).")
    exit(1)

with open(STATE_FILE, 'r', encoding='utf-8') as f:
    state = json.load(f)

pending = state.get('pending')
if not pending:
    print("❌ Không có email nào đang chờ duyệt.")
    exit(1)

# Set confirmed flag
state['pending']['confirmed'] = True
state['pending']['confirmed_at'] = datetime.now().isoformat()
state['pending']['confirmed_via'] = 'telegram'

with open(STATE_FILE, 'w', encoding='utf-8') as f:
    json.dump(state, f, ensure_ascii=False, indent=2)

notifications = pending.get('notifications', [])
count = len(notifications)
doi_tuongs = ', '.join(set(n['doiTuong'] for n in notifications))

print(f"✅ ĐÃ XÁC NHẬN gửi {count} mail cho: {doi_tuongs}")
print(f"📧 Mail sẽ được gửi lúc 23:59 hôm nay.")
