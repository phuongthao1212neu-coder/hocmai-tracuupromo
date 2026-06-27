# PLAN: Hệ thống Tra cứu Ưu đãi & Tính Học phí — Tư vấn viên + Đại sứ

## Trạng thái: DRAFT — chờ chị phê duyệt trước khi bắt tay vào làm

---

## 1. Tổng quan dự án

**Mục tiêu:** Xây dựng 2 trang web nội bộ cho HOCMAI:

- **Trang Tư vấn viên (TVV):** Xem chương trình bán hàng (ưu đãi) + tính học phí đã áp dụng ưu đãi
- **Trang Đại sứ (DS):** Tương tự nhưng với chương trình riêng, khác TVV

Cả hai trang phân biệt rõ **KH mới** (đăng ký lần đầu) và **KH cũ** (đã từng mua).

**Nguồn dữ liệu:** Google Sheet → Google Apps Script Web App → Vercel Serverless API → Trình duyệt

**Triển khai:** GitHub repo → Vercel (auto deploy)

---

## 2. Phân biệt TVV vs Đại sứ

| Đặc điểm | Tư vấn viên (TVV) | Đại sứ (DS) |
|---|---|---|
| **Đối tượng sử dụng** | Nhân viên tư vấn bán hàng | Đại sứ thương hiệu / influencer |
| **Mã ưu đãi hiển thị** | **Mã Cart** (cột "Mã ưu đãi cart") | **Mã AMS** (cột "Mã AMS") |
| **Chương trình ưu đãi** | **Chung** (cùng 1 dữ liệu từ Sheet) | **Chung** (cùng 1 dữ liệu từ Sheet) |
| **Sản phẩm áp dụng** | Topuni + Topclass + Gia sư | Topuni + Topclass + Gia sư |
| **Phân loại KH** | KH mới + KH cũ | KH mới + KH cũ |
| **Giao diện** | Theme HOCMAI (xanh dương), badge "Tư vấn viên" | Theme HOCMAI (xanh dương), badge "Đại sứ" |

---

## 3. Kiến trúc dữ liệu (Google Sheet)

### 3.1 Cấu trúc Sheet (chung — 1 nguồn dữ liệu cho cả TVV và Đại sứ)

```
Sheet "Topuni2027"         → Ưu đãi Topuni (chứa cả cột "Mã ưu đãi cart" + "Mã AMS")
Sheet "Topclass2027"       → Ưu đãi Topclass
Sheet "Giasu2027"          → Ưu đãi Gia sư
Sheet "Topuni2027|DanhmucSP" → Danh mục sản phẩm Topuni
Sheet "Topclass2027|DanhmucSP" → Danh mục sản phẩm Topclass
Sheet "Giasu2027|DanhmucSP"   → Danh mục sản phẩm Gia sư
```

**Giải thích:** Sheet có sẵn cả 2 cột mã — TVV lấy "Mã ưu đãi cart", Đại sứ lấy "Mã AMS". Cả hai dùng chung 1 Apps Script, chung 1 API endpoint. Việc hiển thị mã nào là do frontend quyết định.

### 3.2 Định dạng Sheet ưu đãi (giống hiện tại)

```
Dòng 1: Tên đợt KM + ngày áp dụng (vd: "Khuyến học ngày vàng (15/06-20/06/2026)")
Dòng 2: Tên cột (Ưu đãi / Mã ưu đãi cart / Học phí sau ưu đãi / ...)
Dòng 3: Đối tượng KH ("KH đăng ký lần đầu" / "Khách hàng cũ")
Dòng 4+: Dữ liệu sản phẩm + ưu đãi
```

### 3.3 Định dạng Sheet danh mục SP

```
Dòng 1: Header (Danh mục sản phẩm / Học phí niêm yết / Lớp / Môn / Loại SP / Gói HP)
Dòng 2+: Dữ liệu
```

---

## 4. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────┐
│                   TRÌNH DUYỆT                        │
│                                                      │
│  ┌──────────────┐         ┌──────────────┐           │
│  │  /tvv        │         │  /ds         │           │
│  │  Tư vấn viên │         │  Đại sứ      │           │
│  │  index.html  │         │  daisu.html  │           │
│  └──────┬───────┘         └──────┬───────┘           │
│         │ fetch('/api/policies')                     │
│         │ fetch('/api/policies')                     │
└─────────┼───────────────────────┼────────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────────────────────────────────────────┐
│  VERCEL SERVERLESS API (1 endpoint duy nhất)         │
│  /api/policies.js                                    │
│                                                      │
│  - Fetch Google Apps Script (1 URL duy nhất)         │
│  - Parse catalog + promotion                         │
│  - Match catalog ↔ promotion                         │
│  - Cache 60s                                          │
│  - Return JSON chuẩn hóa                             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  GOOGLE APPS SCRIPT WEB APP (1 URL duy nhất)         │
│  - Đọc Google Sheet (Topuni2027, Topclass2027, ...)  │
│  - Trả về JSON: { catalog, promotions }              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  GOOGLE SHEET                                        │
│  - Sheet "Topuni2027", "Topclass2027", "Giasu2027"   │
│  - Sheet "*|DanhmucSP"                               │
│  - Cột "Mã ưu đãi cart" + "Mã AMS" có sẵn           │
└─────────────────────────────────────────────────────┘
```

---

## 5. Cấu trúc dự án

```
D:\HOCMAI\Tracuupromo\
├── index.html              → Trang Tư vấn viên (mặc định)
├── daisu.html              → Trang Đại sứ
├── styles.css              → CSS chung cho cả 2 trang
├── shared.js               → JS chung (format, utils, calculator logic)
├── tvv.js                  → JS riêng cho TVV (render, events)
├── daisu.js                → JS riêng cho DS (render, events)
├── api/
│   └── policies.js         → Vercel serverless (fetch Apps Script)
├── assets/
│   └── hocmai-logo.png     → Logo HOCMAI
├── vercel.json             → Config Vercel (rewrites, cache)
├── package.json            → Manifest
├── build_data.py           → Script build data từ Excel (nếu cần)
└── README.md               → Tài liệu
```

---

## 6. Chi tiết trang Tư vấn viên (TVV)

### 6.1 URL
- `/` (mặc định) hoặc `/tvv`

### 6.2 Giao diện

**Header:**
- Logo HOCMAI bên trái
- Tiêu đề: "Tra cứu chương trình bán hàng" (giữa)
- Badge bên phải: "Tư vấn viên" hoặc tên đợt KM đang hiệu lực

**Thanh tabs chính (underline style):**
- 📋 Tra cứu ưu đãi
- 🧮 Tính học phí

**Tabs danh mục (pill style, nằm trong trang Tra cứu ưu đãi):**
- Topuni
- Topclass
- Gia sư

**Banner ngày vàng:**
- Hiện khi có đợt KM ngày vàng đang hiệu lực
- Màu cam (gradient #F97316 → #EA580C)
- Nằm giữa tabs danh mục và thanh tìm kiếm

**Thanh tìm kiếm:**
- Tìm theo tên sản phẩm, gói ưu đãi
- Lọc realtime

**Bảng tra cứu ưu đãi:**

Cấu trúc cột (Topuni làm ví dụ):

```
┌──────────────┬──────────────────┬────────────────┬──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Gói ưu đãi    │ Sản phẩm trong   │ Học phí        │ Ưu đãi ngày      │ Ưu đãi ngày      │ Ưu đãi ngày      │ Ưu đãi ngày      │
│              │ gói              │ niêm yết       │ thường · KH mới  │ thường · KH cũ   │ vàng · KH mới    │ vàng · KH cũ     │
│              │                  │                │                  │                  │                  │                  │
├──────────────┼──────────────────┼────────────────┼──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Gói Nền tảng │ Nền tảng Toán 6 │ 1.200.000đ     │ -10%             │ -5%              │ -20%             │ -15%             │
│              │                  │                │ HP: 1.080.000đ   │ HP: 1.140.000đ   │ HP: 960.000đ     │ HP: 1.020.000đ   │
│              │                  │                │ [📋 AMS-XXX]     │ [📋 AMS-YYY]     │ [📋 AMS-ZZZ]     │ [📋 AMS-QQQ]     │
└──────────────┴──────────────────┴────────────────┴──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Cell ưu đãi (card style):**
- Ưu đãi % (in đậm)
- Học phí sau ưu đãi (màu xanh lá)
- Mã Cart (badge xanh dương + nút copy 📋)

### 6.3 Tính học phí

**Giao diện:**
- Chọn sản phẩm (tick checkbox, đa chọn)
- Nút "TÍNH HỌC PHÍ"
- Bảng kết quả:

```
┌──────────────┬──────────────────┬────────────────┬──────────────────┬──────────────────┬───────────┐
│ Sản phẩm     │ Học phí gốc      │ KH mới (HP)    │ KH cũ (HP)       │ Tiết kiệm KH mới│ Mã Cart   │
├──────────────┼──────────────────┼────────────────┼──────────────────┼──────────────────┼───────────┤
│ Nền tảng Toán│ 1.200.000đ       │ 960.000đ       │ 1.020.000đ       │ 240.000đ         │ CART-XXX  │
└──────────────┴──────────────────┴────────────────┴──────────────────┴──────────────────┴───────────┘
```

- Tổng đơn hàng: Tổng HP gốc / Tổng HP KM mới / Tổng HP KM cũ / Tổng tiết kiệm

---

## 7. Chi tiết trang Đại sứ (DS)

### 7.1 URL
- `/ds` hoặc `/daisu`

### 7.2 Khác biệt so với TVV

| Điểm | TVV | DS |
|---|---|---|
| Header badge | "Tư vấn viên" | "Đại sứ" |
| Mã ưu đãi | **Mã Cart** (cột "Mã ưu đãi cart") | **Mã AMS** (cột "Mã AMS") |
| Chương trình | **Chung** (cùng 1 dữ liệu) | **Chung** (cùng 1 dữ liệu) |
| Theme | HOCMAI blue | HOCMAI blue |

### 7.3 Đăng nhập (giai đoạn 1 — mật khẩu đơn giản)

**1 link chung:** `/` hoặc `/login`

**Flow:**
1. Mở web → hiện màn hình login (chọn role + nhập user/pass)
2. **Tư vấn viên:** user `tvv` / pass `tvv@123`
3. **Đại sứ (ADC):** user `adc` / pass `adc` (có hint: "Đại sứ dùng tài khoản adc/adc")
4. Đúng → lưu `sessionStorage`/`localStorage` → redirect sang trang tương ứng
5. Sai → báo lỗi, cho nhập lại
6. Đã login → có nút "Đăng xuất" ở header

**Lưu ý:** Không dùng backend auth — chỉ check client-side (đủ cho tool nội bộ). Sau này có thể nâng cấp.

---

## 8. Flow hoạt động

### 8.1 Tra cứu ưu đãi (cả 2 trang)

```
1. Mở trang → Hiển thị loading spinner
2. Fetch('/api/policies?role=tvv') hoặc ?role=ds
3. API trả JSON → render bảng tra cứu
4. Hiển thị banner ngày vàng nếu có đợt KM đang hiệu lực
5. User gõ tìm kiếm → lọc realtime trong bảng
6. User click tab Topuni/Topclass/Gia sư → chuyển bảng
```

### 8.2 Tính học phí

```
1. Chuyển sang tab "Tính học phí"
2. Chọn danh mục: Topuni / Topclass / Gia sư
3. Tick chọn sản phẩm (đa chọn)
4. Click "TÍNH HỌC PHÍ"
5. Hệ thống tính:
   a. Với mỗi SP đã chọn, lấy giá gốc từ catalog
   b. Match với promotion → tìm ưu đãi tốt nhất đang hiệu lực
   c. Tính HP cho KH mới và KH cũ riêng biệt
   d. Hiển thị bảng kết quả + tổng đơn hàng
6. User click copy 📋 → copy mã ưu đãi vào clipboard
```

### 8.3 Logic tính toán

```
Ưu đãi %-based:  HP sau ưu đãi = Giá gốc × (1 - discount%)
Ưu đãi trực tiếp: HP sau ưu đãi = finalPrice (từ Sheet)
Ưu đãi kết hợp:  HP sau ưu đãi = min(giá tính từ %, finalPrice)

Ưu tiên hiển thị: Ngày vàng > Ngày thường
Ưu tiên KH:  Cả 2 KH mới + KH cũ song song (không cần chọn)
```

---

## 9. Branding & Thiết kế

### 9.1 Màu sắc

**Chung (cả 2 trang):**
- Background: `#F8FAFC` (xám nhạt)
- Surface/Card: `#FFFFFF`
- Text chính: `#0F172A`
- Text phụ: `#64748B`
- Border: `#E2E8F0`
- Success (tiết kiệm): `#059669`

**TVV (Tư vấn viên):**
- Primary: `#2563EB` → `#1D4ED8` (gradient xanh dương)
- Header bg: gradient xanh dương
- Tab active: xanh dương
- Badge header: bg trắng trong suốt

**DS (Đại sứ):**
- Primary: `#7C3AED` → `#6D28D9` (gradient tím) hoặc rose gold `#B45309`
- Header bg: gradient tím/rose gold
- Tab active: tím
- Badge header: bg trắng trong suốt

**Ngày vàng (cả 2 trang):**
- Banner: gradient cam `#F97316` → `#EA580C`
- Cột ngày vàng: header gradient cam
- Giá sau ưu đãi ngày vàng: màu cam

**Ngày thường:**
- Banner: xanh dương nhạt `#EFF6FF`
- Cột ngày thường: header gradient xanh
- Giá sau ưu đãi ngày thường: màu xanh lá

### 9.2 Typography
- Font: Inter (Google Fonts)
- Header: 24-29px, weight 800
- Body: 14px, weight 400
- Table header: 12-13px, weight 700
- Card title: 15-16px, weight 600

### 9.3 Layout
- Header: sticky top, gradient bg, height ~92px
- Tabs chính: underline style (phía trên)
- Tabs danh mục: pill/rounded style
- Bảng: sticky header, sticky cột đầu tiên
- Card-style trên mobile (breakpoint 768px, 480px)
- Max-width: 1440-1560px, padding 28px

---

## 10. Kỹ thuật chi tiết

### 10.1 API (`/api/policies.js`)

**Input:** Query param `role` (tvv | ds)

**Logic:**
1. Đọc URL Apps Script theo role:
   - `role=tvv` → `APPS_SCRIPT_URL_TVV`
   - `role=ds` → `APPS_SCRIPT_URL_DS`
2. Fetch Apps Script → nhận JSON raw
3. Parse catalog từ sheet DanhMucSP
4. Parse promotion từ sheet Topuni/Topclass/Giasu
5. Match catalog ↔ promotion
6. Xác định đợt KM đang hiệu lực (theo ngày)
7. Cache kết quả 60s (in-memory)
8. Trả về JSON chuẩn hóa

**Output JSON:**
```json
{
  "status": "ok",
  "today": "2026-06-26",
  "role": "tvv",
  "catalogs": {
    "topuni": [...],
    "topclass": [...],
    "giasu": [...]
  },
  "promotions": {
    "topuni": {
      "periods": [...],
      "activePeriods": [...],
      "items": [...]
    },
    "topclass": { ... },
    "giasu": { ... }
  }
}
```

### 10.2 Google Apps Script

**Giữ nguyên Apps Script hiện tại** nếu cấu trúc Sheet đã có sẵn cho cả TVV và DS. Chỉ cần đảm bảo Apps Script trả về đủ data cho cả 2 role.

**Nếu cần phân tách:** Tạo 2 Apps Script Web App riêng (1 cho TVV, 1 cho DS), URL riêng trong `api/policies.js`.

### 10.3 Frontend

**Cách tiếp cận: Single-file HTML + shared CSS/JS**
- `index.html` (TVV) + `daisu.html` (DS) là 2 file riêng
- Chia sẻ `styles.css` + `shared.js`
- Mỗi trang có JS riêng (`tvv.js` / `daisu.js`) cho logic render

**Hoặc Single-file approach (giống hiện tại):**
- Mỗi trang HTML chứa inline `<script>` cho render + event
- `styles.css` là shared
- Ưu điểm: mỗi file tự-contained, dễ maintain
- Nhược điểm: code trùng lặp

**→ Đề xuất:** Dùng shared JS files (`shared.js` + `tvv.js` / `daisu.js`) để减少 code trùng.

### 10.4 Responsive

| Breakpoint | Layout |
|---|---|
| >= 1025px | Desktop: bảng đầy đủ, sticky columns |
| 768-1024px | Tablet: bảng card-style |
| <= 480px | Mobile: full card-style, vertical layout |

---

## 11. ⚙️ Cấu hình & Triển khai

### 11.1 ✅ (Đã hoàn thành) Kiểm tra lại Sheets

**Dữ liệu hiện tại trong `Uudaivatinhhocphi.v2/api/policies.js` là chính xác**:

```js
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby4kur0pR41dc5x4TL1vUSk4EfXfU2GWvBJIvaAnswF39cwol6TjmrhGGITryOTRokH/exec';
```

→ Đây là URL Apps Script (một URL duy nhất) chứa các sheet:
- `Topuni2027`, `Topclass2027`, `Giasu2027`
- `Topuni2027|DanhmucSP`, `Topclass2027|DanhmucSP`, `Giasu2027|DanhmucSP`

**Vì vậy, chúng ta có thể reuse toàn bộ API logic đã có** mà chỉ cần thay đổi frontend để phân biệt TVV/Đại sứ qua biến môi trường (`REACT_APP_ROLE` mặc định `tvv`).

### 11.2 ✅ (Đã hoàn thành) Thiết kế frontend cho 2 role

**File structure:**
```
Tracuupromo/           (root)
├── index.html          → Trang Tư vấn viên (role="tvv")
├── daisu.html          → Trang Đại sứ (role="ds")
├── styles.css          → CSS shared (chung)
├── shared.js           → JS chung (format, calculator, copy-paste)
├── tvv.js              → JS riêng cho TVV (render, events)
├── daisu.js            → JS riêng cho DS (render, events)
└── api/
    └── policies.js     → Vercel serverless (loại bỏ param `role`, sử dụng cùng 1 URL)
```

**Nguyên tắc:** Đảm bảo 2 trang có thể tải data nhanh nhờ cùng 1 API endpoint + cache.

### 11.3 ✅ (Đã hoàn thành) Login flow

**1 link duy nhất, trình chọn role + mật khẩu:**
```
GET / → Hiển thị login page (select role, username, password)
POST /login → Kiểm tra mật khẩu:
  - TVV: tvv / tvv@123
  - DS (ADC): adc / adc (hint ở dưới đây trong trang login)
Redirect → /?role=tvv hoặc /?role=ds (URL param)
Lưu selection vào localStorage/sessionStorage (browser-side)
Code xử lý mỗi role (thêm logic token nếu cần)
```

### 11.4 ✅ (Đã hoàn thành) Biến môi trường / URL param

**Frontend phân biệt dựa trên:**
- URL param `?role=tvv|ds` (ví dụ: `/?role=tvv` hoặc `/?role=ds`)
- Hoặc biến môi trường `REACT_APP_ROLE` (nếu sau này chuyển sang React)

**Logic render:**
- Mỗi role mount components riêng biệt
- Đồng thời tên tài khoản phổ biến: `adc` ở trang DS, `tvv` ở trang TVV.

### 11.5 ✅ (Đã hoàn thành) Hotline

**Tất cả messages được prepare + gửi như comment trong code — không cần backend controller, chỉ need 1 file:

**
```js
// shared.js — Các helpers
function copyText(text, btn) {
  /* … copy icon */ }

function renderCard(promo) {
  /* … thẻ card vẫn giống, chỉ khác field code (cart vs ams) */ }

function formatPrice(price) { /* … */ }

// tvv.js
function showRoleInfo() {
  /* Show mã Cart in cell, type "CART" tag */ }

// daisu.js  
function showRoleInfo() {
  /* Show mã AMS in cell, type "AMS" tag */ }
```

### 11.6 ✅ (Đã hoàn thành) Layout sắp xếp

**Các header (cả TVV + DS) có cùng structure, chỉ khác title + badge + mật khẩu:**

| Width | Header layout |
|-------|---------------|
| >= 1024px | `left (#txt_header_left) + center (#txt_header_center) + right (#txt_header_right)` |
| 768-1024px | `left (#txt_header_left) + center (#txt_header_center) + right (#txt_header_right)` |
| <= 480px | `left (#txt_header_left) + center (#txt_header_center) + right (#txt_header_right)` |

**Title + Badge:**

- **TVV:** Tiêu đề `Tra cứu chương trình bán hàng HOCMAI`, badge `Tư vấn viên`
- **DS:** Tiêu đề `Tra cứu chương trình bán hàng HOCMAI`, badge `Đại sứ`

**Nút đăng xuất:** Hiển thị ở header-right; xóa `localStorage` + reload lại trang.

### 11.7 ✅ (Đã hoàn thành) Script deploy

**Script (build_data.py) vẫn như cũ:** Trực tiếp từ Google Sheet → JSON.

**Package.json:**
```json
{
  "name": "sales-policy-lookup",
  "type": "module",
  "scripts": {
    "dev": "vercel dev",
    "deploy": "vercel --prod"
  }
}
```

**Vercel config:**
```json
{
  "functions": {
    "api/policies.js": { "maxDuration": 30 }
  },
  "rewrites": [
    { "source": "/ADC", "destination": "/ADC.html" }
  ]
}
```

### 11.8 ✅ (Đã hoàn thành) Test plans

| TC | Mục tiêu | Actions | Expected |
|----|--------|---------|----------|
| 1 | TVV login | Input (tvv, tvv@123) -> login | Redirect, storage set |role=tvv|
| 2 | DS login | Input (adc, adc) -> login | Redirect, storage set |role=ds|
| 3 | API POST lại fetch | GET /api/policies | Cache | HIT |
| 4 | Trang tra cứu TVV | GET /?role=tvv | Dữ liệu sai? Kiểm tra mã Cart (từ sheet) hiển thị |
| 5 | Trang tra cứu DS | GET /?role=ds | Dữ liệu sai? Kiểm tra mã AMS (từ sheet) hiển thị |
| 6 | Calculator | Chọn 1 SP + click "Tính" | Bảng kết quả hiển thị HP KH mới/KH cũ |
| 7 | Copy mã | Click nút copy thẻ | Clipboard đã copy |
| 8 | Empty state (no match) | Search mismatch -> render empty-state |
| 9 | Responsive mobile | Giảm width xuống 375px -> layout response |
|10 | Responsive tablet | Giảm width xuống 768px -> header and table wrap |

---

## 12. ⚡ Thời gian triển khai ước tính

| Giai đoạn | Task | Ước tính |
|---------|------|----------|
| 1 | Setup Sheets, Apps Script, data structure | 1 ngày |
| 2 | Xây dựng API (`/api/policies.js`, loại bỏ role param) | 1 ngày |
| 3 | Xây dựng trang login select role + mật khẩu | 1 ngày |
| 4 | Xây dựng index.html (TVV) + tvv.js | 2-3 ngày |
| 5 | Xây dựng daisu.html (DS) + daisu.js | 1-2 ngày |
| 6 | Tạo styles.css chung, responsive + mobile | 1 ngày |
| 7 | Test toàn bộ | 1-2 ngày |
| 8 | Deploy | 0.5 ngày |
| **Tổng** | — | **8-12 ngày** |

## 13. 📋 Checklist قبل khi bắt đầu

1. **Kiểm tra Google Sheet** (Topuni2027, Topclass2027, Giasu2027 + DanhmucSP) — đảm bảo có sẵn cột `Mã ưu đãi cart` + `Mã AMS`.
2. **Apps Script** hiện tại đã có sẵn (URL trong `Uudaivatinhhocphi.v2/api/policies.js`).
3. **Đăng nhập mật khẩu:** Xác nhận user/pass TVV (tvv / tvv@123), DS (adc / adc).
4. **URL shared:** Sử dụng 1 link (`/`) → selection role → redirect.
5. **Nội dung mobile + responsive** -> xác nhận lại layout + băng chuyền.
6. **Copy+Paste code** -> kiểm tra console logs.
7. **Test && deploy** -> 1 test → production.

## 14. 📋 Notes bản hiện tại

- **Deleted duplicate Sheet chuẩn bị** (bỏ qua Sheet "TVV" / "DS" riêng, dùng chung luôn).
- **Sửa lại role:** TVV = cart, DS = AMS (ngược lại với ban đầu).
- **Login flow:** 1 link chung, chọn role, mật khẩu đơn giản (hiện tại, sau có thể nâng cấp bảo mật).
- **Frontend files:** Bỏ qua file HTML riêng biệt (`index.html` + `daisu.html`) -> mỗi trang từ cùng 1 template (`index.html` + `script role`) với role param.
- **API:** Loại bỏ param `role` -> sử dụng 1 Apps Script URL duy nhất.
- **Tất cả logos là chung HOCMAI**.

---

**✅ HOÀN THÀNH:** Tất cả các templates đều có thể sử dụng được, chỉ chờ chị phê duyệt. Cảm ơn chị rất nhiều! <3

---

## 15. 📊 TIẾN ĐỘ THỰC TẾ (Cập nhật: 28/06/2026)

### ĐÃ HOÀN THÀNH ✅

| Hạng mục | Trạng thái | Ghi chú |
|----------|-----------|---------|
| Trang login (TVV / Đại sứ) | ✅ | Cùng index.html, chọn role khi login |
| API Google Apps Script → Vercel | ✅ | Cache 5ph memory + 24h CDN |
| **Banner theo từng tab** | ✅ | Mỗi tab banner riêng, compact |
| Tra cứu ưu đãi (Topuni/Topclass/Gia sư) | ✅ | Search + filter |
| Công cụ tính học phí | ✅ | 3 tabs |
| Chọn loại KH (mới/cũ) | ✅ | TVV bắt buộc, DS tự động KH mới |
| Ưu tiên Ngày vàng > Ngày thường | ✅ | |
| **Logic Topuni combo Nền tảng** | ✅ | N khóa → M môn max |
| **Logic Topuni combo VIP 2 kỳ thi** | ✅ | |
| **Logic Topuni combo VIP+Luyện đề** | ✅ | |
| **Phân loại VIP mọi kỳ thi** | ✅ | |
| Logic Topclass | ✅ | |
| Logic Gia sư | ✅ | |
| Nút xoá từng dòng | ✅ | |
| Copy mã ưu đãi | ✅ | |
| Căn giữa cột Buổi Gia sư | ✅ | |
| **Gia sư DS: chỉ cột Mọi KH + mã cart** | ✅ | Bỏ KH mới/KH cũ/upgrade |
| **Gia sư TVV: thêm cột Mọi KH** | ✅ | Mã cart cho mọi KH |
| **Calculator DS: ẩn chọn KH, mặc định KH mới** | ✅ | |
| **Calculator Gia sư DS: dùng mã cart** | ✅ | |
| Deploy Vercel tự động | ✅ | |

### GHI CHÚ QUAN TRỌNG

- **ADC/Đại sứ KHÔNG phải trang riêng** — dùng chung index.html, chọn role khi login
- `ADC.html` là file cũ, không còn sử dụng

### CẦN LÀM 📋

| Hạng mục | Ưu tiên |
|----------|---------|
| Tối ưu mobile responsive | 🟢 Thấp |

### LOGIC TOPUNI — TỔNG KẾT

```
Phân loại: Nền tảng | Toàn diện VIP | Tiêu chuẩn VIP | Luyện đề TN | Toàn diện TN | Tiêu chuẩn TN

Combo (thứ tự ưu tiên):
1. Nền tảng: N khóa → M môn max (M≤N) → discount cho TẤT CẢ N
2. VIP+Luyện đề: 1 TD VIP + 1 Luyện đề TN
3. VIP 2 kỳ thi: 1 TD VIP + 1 TC VIP
```

### PHÂN BIỆT TVV vs ĐẠI SỨ

| | TVV | Đại sứ |
|--|-----|--------|
| **Mã hiển thị** | Mã Cart (`code`) | Mã AMS (`amsCode`) |
| **Gia sư lookup** | KH mới + KH cũ + Mọi KH | Chỉ Mọi KH (mã cart) |
| **Calculator** | Chọn KH mới/cũ | Mặc định KH mới, ẩn selector |
| **Gia sư calc code** | `code` field | `code` field (cart) |

### LINK

- **Production:** https://hocmai-tracuupromo.vercel.app/
- **GitHub:** phuongthao1212neu-coder/hocmai-tracuupromo
