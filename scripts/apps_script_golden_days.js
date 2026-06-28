function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Lịch ngày vàng');
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Sheet not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var data = sheet.getDataRange().getValues();
  var result = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var ngayBatDau = String(row[0] || '').trim();
    var ngayKetThuc = String(row[1] || '').trim();
    var doiTuong = String(row[3] || '').trim();
    var listEmail = String(row[4] || '').trim();
    var noiDungDauThang = String(row[5] || '').trim();
    var noiDungNgayVang = String(row[6] || '').trim();
    if (!doiTuong && !listEmail && !noiDungDauThang && !noiDungNgayVang) continue;
    result.push({
      row: i + 1,
      ngayBatDau: ngayBatDau,
      ngayKetThuc: ngayKetThuc,
      doiTuong: doiTuong,
      listEmail: listEmail,
      noiDungDauThang: noiDungDauThang,
      noiDungNgayVang: noiDungNgayVang
    });
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
