// Test: ghép catalog ↔ promo của Topuni phải phân biệt ĐÚNG lớp (lớp 2 vs lớp 3)
// và ĐÚNG loại gói (Lộ trình S vs Gói S vs Gói VIP).
// Chạy: node test/topuni-match.test.mjs
//
// Cách làm: nạp CHÍNH api/policies.js (không copy code) rồi gọi các hàm thật
// với dữ liệu thật lấy từ API live (/api/policies).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// 1) Nạp api/policies.js + thêm named export để test gọi được hàm nội bộ
const src = readFileSync(join(root, 'api', 'policies.js'), 'utf8');
const tmp = join(here, '_policies_under_test.mjs');
writeFileSync(
  tmp,
  src + '\nexport { matchTopuniCatalog, enrichCatalogWithPromotions, getExamTokens, getGradeToken, getPackageToken };\n'
);
const M = await import('file://' + tmp.replace(/\\/g, '/'));

// 2) Fixture — DỮ LIỆU THẬT từ /api/policies (07/10/2026)
const catRaw = [
  ['Giải pháp toàn diện VIP TN THPT - Năm học 2026-2027', 12000000],
  ['Nền tảng 12 - Môn Ngữ văn - Năm học 2026-2027', 1200000],
  ['Nền tảng 12 - Môn Toán - Năm học 2026-2027', 1200000],
  ['Nền tảng 12 - Môn Vật lí - Năm học 2026-2027', 1200000],
  ['Nền tảng 12 - Môn Hóa học - Năm học 2026-2027', 1200000],
  ['Nền tảng 12 - Môn Tiếng Anh - Năm học 2026-2027', 1200000],
  ['Nền tảng 12 - Môn Sinh học - Năm học 2026-2027', 1200000],
  ['Giải pháp toàn diện TN THPT - Năm học 2026-2027', 8000000],
  ['Giải pháp tiêu chuẩn TN THPT - Năm học 2026-2027', 6000000],
  ['Luyện đề TN THPT - 4 môn - Năm học 2026-2027', 3500000],
  ['Giải pháp VIP HSA - Định lượng, Định tính, Tiếng Anh - lớp 2 - Năm học 2026-2027', 7000000],
  ['Giải pháp VIP HSA - Định lượng, Định tính, Khoa học - lớp 2 - Năm học 2026-2027', 7000000],
  ['Giải pháp VIP QDA - Định lượng, Định tính, Tiếng Anh - lớp 2 - Năm học 2026-2027', 7000000],
  ['Giải pháp VIP QDA - Định lượng, Định tính, Khoa học - lớp 2 - Năm học 2026-2027', 7000000],
  ['Giải pháp VIP TSA - lớp 2 - Năm học 2026-2027', 7000000],
  ['Lộ trình S - QDA - Định lượng, Định tính, Tiếng Anh - Năm học 2026-2027', 4000000],
  ['Lộ trình S - QDA - Định lượng, Định tính, Khoa học - Năm học 2026-2027', 4000000],
  ['Lộ trình S - TSA - Năm học 2026 -2027', 4000000],
  ['Lộ trình S - HSA - Định lượng, Định tính, Tiếng Anh - Năm học 2026-2027', 4000000],
  ['Lộ trình S - HSA - Định lượng, Định tính, Khoa học - Năm học 2026-2027', 4000000],
  ['Giải pháp HSA - Định lượng, Định tính, Tiếng Anh - lớp 3  - Gói VIP - Năm học 2026-2027', 7000000],
  ['Giải pháp HSA - Định lượng, Định tính, Khoa học - lớp 3 - Gói VIP - Năm học 2026-2027', 7000000],
  ['Giải pháp HSA - Định lượng, Định tính, Tiếng Anh - lớp 3 - Gói S - Năm học 2026-2027', 4000000],
  ['Giải pháp HSA - Định lượng, Định tính, Khoa học - lớp 3 - Gói S - Năm học 2026-2027', 4000000],
  ['Giải pháp QDA - Định lượng, Định tính, Tiếng Anh - lớp 3  - Gói VIP - Năm học 2026-2027', 7000000],
  ['Giải pháp QDA - Định lượng, Định tính, Khoa học - lớp 3 - Gói VIP - Năm học 2026-2027', 7000000],
  ['Giải pháp QDA - Định lượng, Định tính, Tiếng Anh - lớp 3 - Gói S - Năm học 2026-2027', 4000000],
  ['Giải pháp QDA - Định lượng, Định tính, Khoa học - lớp 3 - Gói S - Năm học 2026-2027', 4000000],
  ['Giải pháp toàn diện HSA - Định lượng, Định tính, Tiếng Anh - Học chủ động - Năm học 2026-2027', 5000000],
  ['Giải pháp toàn diện HSA - Định lượng, Định tính, Khoa học - Học chủ động - Năm học 2026-2027', 5000000],
  ['Giải pháp tiêu chuẩn HSA - Định lượng, Định tính, Tiếng Anh - Học chủ động - Năm học 2026-2027', 4500000],
  ['Giải pháp tiêu chuẩn HSA - Định lượng, Định tính, Khoa học - Học chủ động - Năm học 2026-2027', 4500000],
  ['Giải pháp Toàn diện TSA - Học chủ động - Năm học 2026-2027', 5000000],
  ['Giải pháp Tiêu chuẩn TSA - Học chủ động - Năm học 2026-2027', 4500000],
];

// promo: [packageName, listPrice, productName, codeNormal, codeGolden]
const proRaw = [
  ['Giải pháp toàn diện VIP kỳ thi TN THPT', 12000000, 'Chọn giải pháp toàn diện VIP  kỳ thi: TN THPT', 'TP10TDVIP1ANJ9', 'TP10TDVIP1MN4B'],
  ['Giải pháp tiêu chuẩn VIP kỳ thi TN THPT', 9000000, 'Chọn giải pháp tiêu chuẩn VIP kỳ thi: TN THPT', 'SYN-p1-N', 'SYN-p1-G'],
  ['Nền tảng 1 môn', 1200000, 'Chọn nền tảng 1 trong các môn: Toán/ Ngữ Văn/ Tiếng Anh/ Vật lí/ Hóa học/ Sinh học', 'TP10NT1KLN5', 'TP10NT1LAM4'],
  ['Combo: Nền tảng 2 môn', 2400000, 'Chọn nền tảng 2 trong các môn', 'SYN-p3-N', 'SYN-p3-G'],
  ['Combo: Nền tảng 3 môn', 3600000, 'Chọn nền tảng 3 trong các môn', 'SYN-p4-N', 'SYN-p4-G'],
  ['Combo: Giải pháp VIP 1 kỳ thi riêng - lớp 2 + Luyện đề TN THPT (4 môn)', 10500000, 'Giải pháp VIP 1 kỳ thi lớp 2 (Chọn 1 trong các kỳ thi TSA/HSA/QDA) | & Luyện đề TN THPT', 'TP10TDLDJ36B', 'TP10TDLD707B'],
  ['Giải pháp toàn diện Kỳ thi TN THPT', 8000000, 'Giải pháp toàn diện Kỳ thi TN THPT', 'TP10TDTNE3JK', 'TP10TDTNMGKD'],
  ['Giải pháp tiêu chuẩn Kỳ thi TN THPT', 6000000, 'Giải pháp tiêu chuẩn Kỳ thi TN THPT', 'SYN-p7-N', 'SYN-p7-G'],
  ['Giải pháp VIP HSA - lớp 2 - Năm học 2026-2027', 7000000, 'Chọn Giải pháp VIP HSA - Định lượng, Định tính, Tiếng Anh lớp 2 hoặc Giải pháp VIP HSA - Định lượng, Định tính, Khoa học lớp 2 | Khai giảng: 09/2026', 'TP10VIPL221HH', 'TP10VIPL2LN57'],
  ['Lộ trình S - HSA - Năm học 2026 -2027', 4000000, 'Chọn Lộ trình S - HSA - Định lượng, Định tính, Tiếng Anh hoặc Lộ trình S - HSA - Định lượng, Định tính, Khoa học', 'TP10LTS2HFNC', 'TP10LTS2ALMM'],
  ['Giải pháp VIP QDA - lớp 2 - Năm học 2026-2027', 7000000, 'Chọn Giải pháp VIP QDA - Định lượng, Định tính, Tiếng Anh lớp 2 hoặc Giải pháp VIP QDA - Định lượng, Định tính, Khoa học lớp 2', 'TP10VIPL2CFN7', 'TP10VIPL2EEBA'],
  ['Lộ trình S - QDA - Năm học 2026 -2027', 4000000, 'Chọn Lộ trình S - QDA - Định lượng, Định tính, Tiếng Anh hoặc Lộ trình S - QDA - Định lượng, Định tính, Khoa học', 'TP10LTS2AF7N', 'TP10LTS285JC'],
  ['Giải pháp VIP TSA - lớp 2 - Năm học 2026-2027', 7000000, 'Chọn Giải pháp VIP TSA - lớp 2 - Năm học 2026-2027', 'TP10VIPL2B20J', 'TP10VIPL2634L'],
  ['Lộ trình S - TSA - Năm học 2026 -2027', 4000000, 'Chọn Lộ trình S - TSA - Năm học 2026 -2027', 'TP10LTS2DE7C', 'TP10LTS2AEH6'],
  ['Giải pháp HSA - lớp 3 - Gói VIP - Năm học 2026-2027', 7000000, 'Chọn Giải pháp HSA - Định lượng, Định tính, Tiếng Anh lớp 3 - Gói VIP hoặc Giải pháp HSA - Định lượng, Định tính, Khoa học lớp 3 - Gói VIP', 'TP10VIPL3KH3J', 'TP10VIPL3K8GJ'],
  ['Giải pháp HSA - lớp 3 - Gói S - Năm học 2026-2027', 4000000, 'Chọn Giải pháp HSA - Định lượng, Định tính, Tiếng Anh lớp 3 - Gói S hoặc Giải pháp HSA - Định lượng, Định tính, Khoa học lớp 3 - Gói S', 'TP10LTS3ML4G', 'TP10LTS31JKK'],
  ['Giải pháp QDA - lớp 3 - Gói VIP - Năm học 2026-2027', 7000000, 'Chọn Giải pháp QDA - Định lượng, Định tính, Tiếng Anh lớp 3 - Gói VIP hoặc Giải pháp QDA - Định lượng, Định tính, Khoa học lớp 3 - Gói VIP', 'TP10VIPL32JEF', 'TP10VIPL3L9DJ'],
  ['Giải pháp QDA - lớp 3 - Gói S - Năm học 2026-2027', 4000000, 'Chọn Giải pháp QDA - Định lượng, Định tính, Tiếng Anh lớp 3 - Gói S hoặc Giải pháp QDA - Định lượng, Định tính, Khoa học lớp 3 - Gói S', 'TP10LTS3NLKC', 'TP10LTS3M39B'],
  ['Giải pháp Toàn diện HSA - Học chủ động - Năm học 2026-2027', 5000000, 'Chọn Giải pháp Toàn diện HSA - Định lượng, Định tính, Tiếng Anh - Học chủ động hoặc ... Khoa học - Học chủ động', 'TP10TDCD25JJ', 'TP10TDCDEKAK'],
  ['Giải pháp Toàn diện TSA - Học chủ động - Năm học 2026-2027', 5000000, 'Chọn Giải pháp Toàn diện TSA - Học chủ động', 'TP10TDCDN560', 'TP10TDCD272L'],
  ['Giải pháp Tiêu chuẩn HSA - Học chủ động - Năm học 2026-2027', 4500000, 'Chọn Giải pháp Toàn diện HSA - ... - Học chủ động', 'TP10TCCDEFML', 'TP10TCCDJLFH'],
  ['Giải pháp Tiêu chuẩn TSA - Học chủ động - Năm học 2026-2027', 4500000, 'Chọn Giải pháp Toàn diện TSA - Học chủ động', 'SYN-p21-N', 'SYN-p21-G'],
  ['Combo: Giải pháp VIP 1 kỳ thi riêng - lớp 3 + Luyện đề TN THPT (4 môn)', 10500000, 'Giải pháp VIP 1 kỳ thi lớp 3 (Chọn 1 trong các kỳ thi HSA/QDA) | & Luyện đề TN THPT', 'TP10VIPLD64M1', 'TP10VIPLDN3C6'],
];

const PERIOD_N = 'Khuyến học ngày thường (Từ 01/10/2026 - 30/10/2026)';
const PERIOD_G = 'Khuyến học ngày vàng (Từ 05/10/2026 - 09/10/2026)';

const cat = catRaw.map(([name, listPrice]) => ({ name, listPrice }));
const pro = proRaw.map(([packageName, listPrice, productName, cn, cg]) => ({
  packageName,
  listPrice,
  productName,
  promotions: {
    [PERIOD_N]: { all: { code: cn, discount: 0.25 } },
    [PERIOD_G]: { all: { code: cg, discount: 0.32 } },
  },
}));

// 3) Mapping ĐÚNG kỳ vọng: catalog index → promo index (null = không có ưu đãi riêng)
const EXPECT = {
  0: 0,
  1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2,
  7: 6,
  8: 7,
  9: null,
  10: 8, 11: 8,
  12: 10, 13: 10,
  14: 12,
  15: 11, 16: 11,
  17: 13,
  18: 9, 19: 9,
  20: 14, 21: 14,
  22: 15, 23: 15,
  24: 16, 25: 16,
  26: 17, 27: 17,
  28: 18, 29: 18,
  30: 20, 31: 20,
  32: 19,
  33: 21,
};

// 4) Chạy code THẬT
M.enrichCatalogWithPromotions(cat, pro, M.matchTopuniCatalog);

let pass = 0, fail = 0;
const shortName = (n) => n.replace(/ - Năm học.*/, '').replace(/Năm học.*/, '').trim();

console.log('=== Sau khi sửa: mã ngày thường gán cho từng sản phẩm Topuni ===\n');
cat.forEach((c, i) => {
  const got = c.promotions[PERIOD_N] && c.promotions[PERIOD_N].all;
  const gotCode = got ? got.code : null;
  const expCode = EXPECT[i] === null ? null : proRaw[EXPECT[i]][3];
  const ok = gotCode === expCode;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} cat[${String(i).padStart(2)}] ${shortName(c.name).padEnd(72).slice(0, 72)} → ${gotCode || '—'}${ok ? '' : `   (mong đợi ${expCode || '—'})`}`);
});

// 5) Bằng chứng lỗi CŨ: mô phỏng match cũ (boolean, dòng sau ghi đè) cho vài ca lỗi
function oldMatch(cat, pro) {
  if (Number(cat.listPrice) <= 0 || Number(cat.listPrice) !== Number(pro.listPrice)) return false;
  const t1 = M.getExamTokens(cat.name);
  const t2 = M.getExamTokens((pro.packageName || '') + ' ' + (pro.productName || ''));
  if (t1.length === 0 || t2.length === 0) return true;
  if (t2.length >= 4) return true;
  return t2.some((t) => t1.includes(t));
}
const oldCat = catRaw.map(([name, listPrice]) => ({ name, listPrice }));
M.enrichCatalogWithPromotions(oldCat, pro, oldMatch);
const bugCa = [10, 12, 15, 18];
console.log('\n=== Lỗi CŨ (trước khi sửa) ở đúng các ca bị ảnh hưởng ===\n');
bugCa.forEach((i) => {
  const got = oldCat[i].promotions[PERIOD_N] && oldCat[i].promotions[PERIOD_N].all;
  console.log(`cat[${i}] ${shortName(catRaw[i][0]).padEnd(60).slice(0, 60)} → ${got ? got.code : '—'}  (đúng phải là ${proRaw[EXPECT[i]][3]})`);
});

console.log(`\n=== KẾT QUẢ: ${pass} pass, ${fail} fail ===`);

// 6) Kiểm tra frontend: trích điều kiện THẬT trong index.html để chọn dòng combo lớp 2,
// rồi chạy trên danh sách packageName thật → chỉ được khớp DUY NHẤT dòng "lớp 2".
const idx = readFileSync(join(root, 'index.html'), 'utf8');
const mCond = idx.match(/if \((.+)\)\s*vipLop2Combo = pw2;/);
if (!mCond) {
  console.log('FAIL không trích được điều kiện combo lớp 2 trong index.html');
  fail++;
} else {
  const condSrc = mCond[1];
  const cond = new Function('pn2', `return (${condSrc});`);
  const matched = proRaw.map(([pn], i) => (cond(pn) ? i : -1)).filter((i) => i >= 0);
  const okCombo = matched.length === 1 && matched[0] === 5;
  okCombo ? pass++ : fail++;
  console.log(`\n=== Frontend: dòng combo khớp điều kiện "lớp 2" → promo index [${matched.join(', ')}] (chỉ được là [5]) ===`);
  console.log(`${okCombo ? 'OK  ' : 'FAIL'} combo lớp 2 chọn đúng dòng, mã ngày thường = ${proRaw[5][3]}`);
}

console.log(`\n=== TỔNG: ${pass} pass, ${fail} fail ===`);
process.exitCode = fail === 0 ? 0 : 1;
