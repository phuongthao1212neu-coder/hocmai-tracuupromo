// test-status-col.mjs — chạy: node test-status-col.mjs
// Kiểm tra tính năng cột TRẠNG THÁI (active/deactive) không phá logic cũ.
import { __test } from './api/policies.js';

const { findStatusCol, isItemDeactivated, parseSheetPromotions, parseVactPromotions, parseTopuniPromotions } = __test;

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

// ---------- Fixture: bảng Topuni không có cột status ----------
function makeTopuniRows(extraHeaderCells = [], rowsWithStatus = []) {
  const header = ['STT', 'Tên gói', 'Tên SP', 'Thành phần', 'Học phí',
    'Khuyến học ngày vàng (01/01-31/12/2026)', '', 'Khuyến học ngày thường (01/01-31/12/2026)', '',
    ...extraHeaderCells];
  const sub = ['', '', '', '', '', 'Ưu đãi', 'Mã', 'Ưu đãi', 'Mã', ...extraHeaderCells.map((_, i) => i === 0 ? 'Ưu đãi' : '')];
  const cust = ['', '', '', '', '', 'Học viên mới', 'Học viên cũ', 'Học viên mới', 'Học viên cũ'];
  const rows = [header, sub, cust];
  const base = ['1', 'Gói A', 'Toán 6', 'A+B', 5000000, 0.2, 'M1', 0.1, 'M2'];
  const base2 = ['2', 'Gói B', 'Văn 7', 'C+D', 3000000, 0.1, 'M3', 0.05, 'M4'];
  // rowsWithStatus: [ {statusValue, isBase2} ... ]
  const active = base.slice();
  const deactive = base2.slice();
  deactive[0] = '2';
  rows.push(active);
  rows.push(deactive);
  return rows;
}

// ---------- 1. Không có cột status ----------
console.log('\n[1] Không có cột TRẠNG THÁI — giữ nguyên toàn bộ');
{
  const rows = makeTopuniRows();
  const res = parseTopuniPromotions(rows);
  assert('findStatusCol = -1', findStatusCol(rows) === -1);
  assert('periods = 2', res.periods.length === 2, JSON.stringify(res.periods.map(p => p.name)));
  assert('items = 2 (không lọc)', res.items.length === 2, `got ${res.items.length}`);
  assert('periods[0].colEnd <= 9 (không vượt cột status)', res.periods.every(p => p.colEnd <= 9));
}

// ---------- 2. Cột TRẠNG THÁI ở giữa bảng (sau periods) ----------
console.log('\n[2] Cột TRẠNG THÁI ở giữa bảng (giữa các period)');
{
  // Period 1 ở col 5-6, KIỂM TRA: cột status ở GIỮA (col 9), period 2 ở col 10-11
  const header = ['STT', 'Tên gói', 'Tên SP', 'Thành phần', 'Học phí',
    'Khuyến học ngày vàng (01/01-31/12/2026)', '', 'Khuyến học ngày thường (01/01-31/12/2026)', '',
    'TRẠNG THÁI', 'Khuyến học đặc biệt (01/02-28/02/2026)', ''];
  const sub = ['', '', '', '', '', 'Ưu đãi', 'Mã', 'Ưu đãi', 'Mã', 'Trạng thái', 'Ưu đãi', 'Mã'];
  const cust = ['', '', '', '', '', 'Học viên mới', 'Học viên cũ', 'Học viên mới', 'Học viên cũ', '', 'Học viên mới', 'Học viên cũ'];
  const rows = [header, sub, cust];
  rows.push(['1', 'Gói A', 'Toán 6', 'A+B', 5000000, 0.2, 'M1', 0.1, 'M2', '', 0.3, 'M7']);
  rows.push(['2', 'Gói B', 'Văn 7', 'C+D', 3000000, 0.1, 'M3', 0.05, 'M4', '', 0.2, 'M8']);
  rows.push(['3', 'Gói C', 'Lý 8', 'E+F', 4000000, 0.15, 'M5', 0.08, 'M6', '', 0.25, 'M9']);
  rows[2][9] = 'TRẠNG THÁI'; // cust header cột status
  rows[3][9] = 'Deactive'; // Gói A ở giữa
  const res = parseTopuniPromotions(rows);
  assert('findStatusCol = 9', findStatusCol(rows) === 9, `got ${findStatusCol(rows)}`);
  assert('periods = 3 (period 2 nằm SAU cột status vẫn được dò)', res.periods.length === 3, `got ${res.periods.length}: ${JSON.stringify(res.periods.map(p => p.name))}`);
  assert('periods[2].colEnd = 12 (không bị cắt tại status)', res.periods[2].colEnd === 12, `got ${res.periods[2].colEnd}`);
  assert('periods[1].colEnd = 10 (period sau status vẫn kết thúc đúng)', res.periods[1].colEnd === 10, `got ${res.periods[1].colEnd}`);
  // Gói A (row 3) Deactive → bị lọc, Gói B/C giữ nguyên (Active/trống)
  assert('items = 2 (Gói A deactive bị lọc)', res.items.length === 2, `got ${res.items.length}: ${JSON.stringify(res.items.map(i => i.packageName))}`);
  assert('items gồm Gói B + Gói C', res.items.some(i => i.packageName === 'Gói B') && res.items.some(i => i.packageName === 'Gói C'));
  // Gói B promotions = 3 periods (vàng + thường + đặc biệt)
  const gb = res.items.find(i => i.packageName === 'Gói B');
  assert('Gói B promotions = 3 periods (period sau cột status vẫn có)', Object.keys(gb.promotions || {}).length === 3, `got ${Object.keys(gb.promotions || {}).length}`);
}

// ---------- 2b. Cột TRẠNG THÁI ở CUỐI bảng (vị trí khuyến nghị) ----------
console.log('\n[2b] Cột TRẠNG THÁI ở cuối bảng (vị trí khuyến nghị)');
{
  const header = ['STT', 'Tên gói', 'Tên SP', 'Thành phần', 'Học phí',
    'Khuyến học ngày vàng (01/01-31/12/2026)', '', 'Khuyến học ngày thường (01/01-31/12/2026)', '', 'TRẠNG THÁI'];
  const sub = ['', '', '', '', '', 'Ưu đãi', 'Mã', 'Ưu đãi', 'Mã', 'Trạng thái'];
  const cust = ['', '', '', '', '', 'Học viên mới', 'Học viên cũ', 'Học viên mới', 'Học viên cũ', ''];
  const rows = [header, sub, cust];
  rows.push(['1', 'Gói A', 'Toán 6', 'A+B', 5000000, 0.2, 'M1', 0.1, 'M2', 'Active']);
  rows.push(['2', 'Gói B', 'Văn 7', 'C+D', 3000000, 0.1, 'M3', 0.05, 'M4', 'Deactive']);
  rows.push(['3', 'Gói C', 'Lý 8', 'E+F', 4000000, 0.15, 'M5', 0.08, 'M6', '']); // trống = active
  const res = parseTopuniPromotions(rows);
  assert('findStatusCol = 9', findStatusCol(rows) === 9, `got ${findStatusCol(rows)}`);
  assert('periods = 2', res.periods.length === 2, `got ${res.periods.length}`);
  assert('items = 2 (Gói B deactive bị lọc)', res.items.length === 2, `got ${res.items.length}: ${JSON.stringify(res.items.map(i => i.packageName))}`);
  assert('items gồm Gói A + Gói C', res.items.some(i => i.packageName === 'Gói A') && res.items.some(i => i.packageName === 'Gói C'));
  assert('Gói A promotions = 2 periods', Object.keys(res.items[0].promotions || {}).length === 2);
}

// ---------- 2c. Nhãn TRẠNG THÁI chỉ ở SUB-HEADER (hàng 1), header chính trống ----------
console.log('\n[2c] Nhãn TRẠNG THÁI chỉ ở sub-header (hàng 1)');
{
  const header = ['STT', 'Tên gói', 'Tên SP', 'Thành phần', 'Học phí',
    'Khuyến học ngày vàng (01/01-31/12/2026)', '', 'Khuyến học ngày thường (01/01-31/12/2026)', '', ''];
  const sub = ['', '', '', '', '', 'Ưu đãi', 'Mã', 'Ưu đãi', 'Mã', 'Trạng thái sản phẩm'];
  const cust = ['', '', '', '', '', 'Học viên mới', 'Học viên cũ', 'Học viên mới', 'Học viên cũ', ''];
  const rows = [header, sub, cust];
  rows.push(['1', 'Gói A', 'Toán 6', 'A+B', 5000000, 0.2, 'M1', 0.1, 'M2', 'Active']);
  rows.push(['2', 'Gói B', 'Văn 7', 'C+D', 3000000, 0.1, 'M3', 0.05, 'M4', 'Deactive']);
  const res = parseTopuniPromotions(rows);
  assert('findStatusCol = 9 (tìm thấy ở sub-header)', findStatusCol(rows) === 9, `got ${findStatusCol(rows)}`);
  assert('periods = 2', res.periods.length === 2, `got ${res.periods.length}`);
  assert('items = 1 (Gói B deactive bị lọc)', res.items.length === 1, `got ${res.items.length}`);
  assert('Gói A promotions = 2 periods', Object.keys(res.items[0].promotions || {}).length === 2);
}

// ---------- 3. Cột status ở cuối bảng ----------
console.log('\n[3] Cột TRẠNG THÁI ở cuối bảng');
{
  const header = ['STT', 'Tên gói', 'Tên SP', 'Thành phần', 'Học phí',
    'Khuyến học ngày vàng (01/01-31/12/2026)', '', 'Khuyến học ngày thường (01/01-31/12/2026)', '', '', 'TRẠNG THÁI'];
  const sub = ['', '', '', '', '', 'Ưu đãi', 'Mã', 'Ưu đãi', 'Mã', '', 'Trạng thái'];
  const cust = ['', '', '', '', '', 'Học viên mới', 'Học viên cũ', 'Học viên mới', 'Học viên cũ', '', ''];
  const rows = [header, sub, cust];
  rows.push(['1', 'Gói A', 'Toán 6', 'A+B', 5000000, 0.2, 'M1', 0.1, 'M2', '', 'Active']);
  rows.push(['2', 'Gói B', 'Văn 7', 'C+D', 3000000, 0.1, 'M3', 0.05, 'M4', '', 'Deactive']);
  const res = parseTopuniPromotions(rows);
  assert('findStatusCol = 10', findStatusCol(rows) === 10, `got ${findStatusCol(rows)}`);
  assert('periods = 2', res.periods.length === 2, `got ${res.periods.length}`);
  assert('periods[1].colEnd = 11 (vị trí cuối bảng, không bị cắt)', res.periods[1].colEnd === 11, `got ${res.periods[1].colEnd}`);
  assert('items = 1 (chỉ Gói A)', res.items.length === 1, `got ${res.items.length}`);
  assert('Gói A promotions = 2 periods', Object.keys(res.items[0].promotions || {}).length === 2);
}

// ---------- 4. V-ACT có cột status ----------
console.log('\n[4] V-ACT có cột TRẠNG THÁI');
{
  const header = ['STT', 'Gói ưu đãi', 'TGKG', 'Mô tả', 'Học phí',
    'Chương trình ưu đãi chung', '', 'TRẠNG THÁI'];
  const sub = ['', '', '', '', '', 'Ưu đãi', 'Học phí ưu đãi', ''];
  const cust = ['', '', '', '', '', 'KH cá nhân', 'KH nhóm', ''];
  const rows = [header, sub, cust];
  rows.push(['1', 'VIP Toàn diện', '01/01', 'Mô tả', 7000000, 0.2, 5600000, 'Active']);
  rows.push(['2', 'Lộ trình S', '02/02', 'Mô tả', 4000000, 0.1, 3600000, 'Deactive']);
  rows.push(['3', 'Gói C', '03/03', 'Mô tả', 5000000, 0.15, 4250000, '']); // trống = active
  const res = parseVactPromotions(rows);
  assert('findStatusCol = 7', findStatusCol(rows) === 7, `got ${findStatusCol(rows)}`);
  assert('periods[0].colEnd = 8 (vị trí cuối bảng, không bị cắt)', res.periods[0] && res.periods[0].colEnd === 8, JSON.stringify(res.periods));
  assert('items = 2 (Lộ trình S bị lọc)', res.items.length === 2, `got ${res.items.length}`);
  assert('items gồm VIP + Gói C', res.items.some(i => i.packageName === 'VIP Toàn diện') && res.items.some(i => i.packageName === 'Gói C'));
  assert('Gói C promotions giữ nguyên (KH cá nhân + KH nhóm)', res.items.find(i => i.packageName === 'Gói C').promotions['Chương trình ưu đãi chung'] && Object.keys(res.items.find(i => i.packageName === 'Gói C').promotions['Chương trình ưu đãi chung']).length === 2);
}

// ---------- 5. isItemDeactivated edge cases ----------
console.log('\n[5] isItemDeactivated — các giá trị trạng thái');
{
  assert('Deactive → true', isItemDeactivated(1, [null, 'Deactive']) === true);
  assert('deactive (thường) → true', isItemDeactivated(1, [null, 'deactive']) === true);
  assert('Deactivated → true', isItemDeactivated(1, [null, 'Deactivated']) === true);
  assert('Ngừng bán → true', isItemDeactivated(1, [null, 'Ngừng bán']) === true);
  assert('Không bán → true', isItemDeactivated(1, [null, 'không bán']) === true);
  assert('Inactive → true', isItemDeactivated(1, [null, 'Inactive']) === true);
  assert('0 → true', isItemDeactivated(1, [null, '0']) === true);
  assert('Active → false', isItemDeactivated(1, [null, 'Active']) === false);
  assert('trống → false', isItemDeactivated(1, [null, '']) === false);
  assert('null → false', isItemDeactivated(1, [null, null]) === false);
  assert('statusCol -1 → false (không có cột)', isItemDeactivated(-1, [null, 'Deactive']) === false);
  assert('"Hoạt động" → false', isItemDeactivated(1, [null, 'Hoạt động']) === false);
}

// ---------- 6. parseSheetPromotions không có status (regression) ----------
console.log('\n[6] parseSheetPromotions không có status — giữ nguyên');
{
  const rows = makeTopuniRows();
  const res = parseSheetPromotions(rows, [
    { col: 0, key: 'stt', asNumber: true },
    { col: 1, key: 'packageName' },
    { col: 2, key: 'productName' },
    { col: 3, key: 'components' },
    { col: 4, key: 'listPrice', asNumber: true }
  ]);
  assert('items = 2', res.items.length === 2);
  assert('periods = 2', res.periods.length === 2);
}

console.log(`\n===== ${pass} passed, ${fail} failed =====`);
process.exit(fail > 0 ? 1 : 0);