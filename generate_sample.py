#!/usr/bin/env python3
"""
Script to generate sample data for HOCMAI Sales Policy Lookup (ADC role).
Output is JSON matching the structure expected by /api/policies.js (the raw from Apps Script).
This can be used for local testing without calling Google Apps Script.
"""

import json
import random
from datetime import datetime, timedelta

# Helper to generate realistic data

def random_int(minv, maxv):
    return random.randint(minv, maxv)

def random_price(base):
    return int(base * random.uniform(0.9, 1.0))

def get_date_range(days_from=0, length=7):
    start = datetime.now() + timedelta(days=days_from)
    end = start + timedelta(days=length - 1)
    fmt = lambda d: d.strftime('%d/%m/%Y')
    return f'{fmt(start)}-{fmt(end)}'

def generate_topuni_catalog():
    grades = ['6', '7', '8']
    subjects = ['Toán', 'Ngữ văn', 'Tiết học', 'Môn tự chọn']
    types = ['Nền tảng', 'Chuyên sâu', 'Nâng cao']
    packages = ['Gói A', 'Gói B', 'Gói C']
    items = []
    for i in range(1, 6):
        grade = random.choice(grades)
        subject = random.choice(subjects)
        typ = random.choice(types)
        pkg = random.choice(packages)
        base_price = random_int(1200000, 3500000)
        items.append({
            'name': f'{typ} {subject} {grade}',
            'listPrice': base_price,
            'grade': grade,
            'subject': subject,
            'productType': typ,
            'feePackage': pkg,
            'form': random.choice(['Online', 'Offline', 'Hybrid'])
        })
    return items

def generate_topuni_promotions():
    # Header rows as per parseSheetPromotions format:
    # Row0: period headers — merged cell style: name only at first col, empty for subsequent cols
    # Row1: column names (sub-header)
    # Row2: customer types
    # Row3+: data
    rows = []
    # Period definitions (golden and normal), each spans 2 cols (KH mới + KH cũ)
    periods = [
        {'name': 'Khuyến học ngày vàng (15/06-20/06/2026)', 'type': 'golden'},
        {'name': 'Khuyến học ngày thường (21/06-30/06/2026)', 'type': 'normal'}
    ]
    # Build header row
    header = []
    # Fixed columns
    for i in range(5):
        header.append('col_fixed_' + str(i))
    # Period columns: each period spans 2 cols, name only at first col
    for p in periods:
        header.append(p['name'])
        header.append('')  # second column empty (merged cell)
    rows.append(header)

    # Sub-header row: field names for each period column
    sub = []
    for i in range(5):
        sub.append('fixed')
    for p in periods:
        sub.append('Ưu đãi')
        sub.append('Mã AMS')
    rows.append(sub)

    # Customer type row
    cust = []
    for i in range(5):
        cust.append('')
    for p in periods:
        cust.append('Học viên mới')
        cust.append('Học viên cũ')
    rows.append(cust)

    # Data rows
    catalog = generate_topuni_catalog()
    for idx, cat in enumerate(catalog[:4], start=1):
        row = []
        # Fixed columns
        row.append(str(idx))
        row.append(cat['name'])
        row.append(cat['listPrice'])
        row.append('Thành phần A + B')
        row.append(cat['listPrice'])
        # Promo columns
        for p in periods:
            if p['type'] == 'golden':
                # discount 20%, AMS code
                disc = 0.2
                ams = f'AMS-{random_int(1000,9999)}'
                row.append(format(disc, '.2f'))
                row.append(ams)
            else:
                disc = 0.05
                ams = f'AMS-{random_int(1000,9999)}'
                row.append(format(disc, '.2f'))
                row.append(ams)
        rows.append(row)

    return rows

def generate_topclass_catalog():
    types = ['Toán', 'Lý', 'Hóa', 'Sinh', 'Ngữ văn', 'Sử']
    grades = ['10', '11', '12']
    packages = ['Nhóm', 'Lớp', 'Cá nhân']
    items = []
    for i in range(1, 6):
        typ = random.choice(types)
        grade = random.choice(grades)
        pkg = random.choice(packages)
        qty = random_int(30, 120)
        price = random_int(800000, 2500000)
        items.append({
            'productType': typ,
            'feePackage': pkg,
            'gradeLevel': grade,
            'subject': typ,
            'quantity': qty
        })
    return items

def generate_topclass_promotions():
    rows = []
    periods = [
        {'name': 'Khuyến học ngày vàng (01/07-07/07/2026)', 'type': 'golden'},
        {'name': 'Khuyến học ngày thường (08/07-20/07/2026)', 'type': 'normal'}
    ]
    header = []
    for i in range(5):
        header.append('col_fixed_' + str(i))
    for p in periods:
        header.append(p['name'])
        header.append(p['name'])
    rows.append(header)

    sub = []
    for i in range(5):
        sub.append('fixed')
    for p in periods:
        sub.append('Ưu đãi')
        sub.append('Mã AMS')
    rows.append(sub)

    cust = []
    for i in range(5):
        cust.append('')
    for p in periods:
        cust.append('Học viên mới')
        cust.append('Học viên cũ')
    rows.append(cust)

    catalog = generate_topclass_catalog()
    for idx, cat in enumerate(catalog[:4], start=1):
        row = []
        row.append(str(idx))
        row.append(cat['productType'])
        row.append(cat['feePackage'])
        row.append(cat['gradeLevel'])
        row.append(cat['subject'])
        for p in periods:
            disc = 0.2 if p['type'] == 'golden' else 0.07
            ams = f'AMS-{random_int(1000,9999)}'
            row.append(format(disc, '.2f'))
            row.append(ams)
        rows.append(row)
    return rows

def generate_giasu_catalog():
    names = ['Gia sư Toán 6', 'Gia sư Ngữ văn 7', 'Gia sư Vật lý 12', 'Gia sư Hóa 10']
    items = []
    for n in names:
        sessions = random_int(10, 60)
        price_session = random_int(200000, 500000)
        total = sessions * price_session
        items.append({
            'name': n,
            'sessions': sessions,
            'pricePerSession': price_session,
            'totalListPrice': total
        })
    return items

def generate_giasu_promotions():
    rows = []
    periods = [
        {'name': 'Khuyến học ngày vàng (10/07-15/07/2026)', 'type': 'golden'},
        {'name': 'Khuyến học ngày thường (16/07-30/07/2026)', 'type': 'normal'}
    ]
    header = []
    for i in range(4):
        header.append('col_fixed_' + str(i))
    for p in periods:
        header.append(p['name'])
        header.append(p['name'])
    rows.append(header)

    sub = []
    for i in range(4):
        sub.append('fixed')
    for p in periods:
        sub.append('Ưu đãi')
        sub.append('Mã AMS')
    rows.append(sub)

    cust = []
    for i in range(4):
        cust.append('')
    for p in periods:
        cust.append('Học viên mới')
        cust.append('Học viên cũ')
    rows.append(cust)

    catalog = generate_giasu_catalog()
    for idx, cat in enumerate(catalog[:3], start=1):
        row = []
        row.append(str(idx))
        row.append(cat['name'])
        row.append(cat['sessions'])
        row.append(cat['pricePerSession'])
        row.append(cat['totalListPrice'])
        for p in periods:
            disc = 0.25 if p['type'] == 'golden' else 0.1
            ams = f'AMS-{random_int(1000,9999)}'
            row.append(format(disc, '.2f'))
            row.append(ams)
        rows.append(row)
    return rows

def main():
    # Build raw JSON structure as returned by Apps Script
    raw = {
        'updatedAt': datetime.now().isoformat(),
        'topuni_catalog': generate_topuni_catalog(),
        'topuni': generate_topuni_promotions(),
        'topclass_catalog': generate_topclass_catalog(),
        'topclass': generate_topclass_promotions(),
        'giasu_catalog': generate_giasu_catalog(),
        'giasu': generate_giasu_promotions(),
    }
    with open('generated_sample.json', 'w', encoding='utf-8') as f:
        json.dump(raw, f, ensure_ascii=False, indent=2)
    print('Generated sample data at generated_sample.json')
    print('You can use this JSON to test frontend without calling Google Apps Script.')

if __name__ == '__main__':
    main()