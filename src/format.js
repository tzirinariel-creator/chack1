// Sheet formatting - RTL, colors, column widths, pie charts
// Uses google-auth-library JWT.request() for direct Google Sheets API calls

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

const COLORS = {
  headerBg: { red: 0.067, green: 0.333, blue: 0.8 },   // #1155CC
  headerText: { red: 1, green: 1, blue: 1 },
  altRow: { red: 0.93, green: 0.95, blue: 0.98 },        // Light blue-gray zebra
  white: { red: 1, green: 1, blue: 1 },
  summaryBg: { red: 0.85, green: 0.9, blue: 0.98 },
  greenText: { red: 0.15, green: 0.5, blue: 0.15 },
  redText: { red: 0.7, green: 0.1, blue: 0.1 },
};

async function batchUpdate(auth, spreadsheetId, requests) {
  await auth.request({
    url: `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
    method: 'POST',
    data: { requests },
  });
}

function addColumnWidths(requests, sheetId, widths) {
  for (const [startIndex, pixelSize] of widths) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex, endIndex: startIndex + 1 },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    });
  }
}

async function formatSheet(doc, auth, monthlySheetInfo) {
  const spreadsheetId = doc.spreadsheetId;
  const requests = [];

  // === GLOBAL: format all sheets ===
  for (const sheet of doc.sheetsByIndex) {
    const sid = sheet.sheetId;

    // RTL
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: sid, rightToLeft: true },
        fields: 'rightToLeft',
      },
    });

    // Header: blue background, white bold text, centered
    requests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.headerBg,
            textFormat: { foregroundColor: COLORS.headerText, bold: true, fontSize: 11 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });

    // Freeze header + height
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: sid, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: sid, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: 'pixelSize',
      },
    });
  }

  // === MASTER: עסקאות sheet ===
  const txnSheet = doc.sheetsByTitle['עסקאות'];
  if (txnSheet) {
    const sid = txnSheet.sheetId;
    // Column widths: תאריך עסקה, תאריך חיוב, עסק, קטגוריה, סכום, סכום מקורי, מטבע, סטטוס, סוג, הערה, החזר?
    addColumnWidths(requests, sid, [
      [0, 110], [1, 110], [2, 250], [3, 120], [4, 100],
      [5, 100], [6, 60], [7, 80], [8, 90], [9, 160], [10, 60],
    ]);
    // Hide מזהה column (11)
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: sid, dimension: 'COLUMNS', startIndex: 11, endIndex: 12 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    });
    // Number format for סכום column (4)
    requests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0.00' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
  }

  // === SUMMARY: סיכום חודשי ===
  const summarySheet = doc.sheetsByTitle['סיכום חודשי'];
  if (summarySheet) {
    addColumnWidths(requests, summarySheet.sheetId, [
      [0, 100], [1, 130], [2, 100], [3, 100], [4, 100], [5, 120],
    ]);
  }

  // === CATEGORIES: לפי קטגוריה ===
  const catSheet = doc.sheetsByTitle['לפי קטגוריה'];
  if (catSheet) {
    addColumnWidths(requests, catSheet.sheetId, [
      [0, 100], [1, 120], [2, 100], [3, 120], [4, 100],
    ]);
  }

  // === MONTHLY SHEETS ===
  for (const info of (monthlySheetInfo || [])) {
    const sid = info.sheetId;

    // Column widths: תאריך, עסק, קטגוריה, סכום, סוג, הערה, (gap), קטגוריה, סכום, אחוז
    addColumnWidths(requests, sid, [
      [0, 110], [1, 250], [2, 120], [3, 100], [4, 90], [5, 160],
      [6, 30], [7, 120], [8, 100], [9, 80],
    ]);

    // Number format for transaction amount column (3)
    requests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 },
        cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0.00' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    });

    // Bold + background for budget summary section (columns H-I)
    const sRow = info.summaryStartRow;
    requests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: sRow, endRowIndex: sRow + 4, startColumnIndex: 7, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 11 },
            backgroundColor: COLORS.summaryBg,
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    });

    // Number format for category amount column (8)
    requests.push({
      repeatCell: {
        range: { sheetId: sid, startRowIndex: 1, endRowIndex: info.categoryCount + 1, startColumnIndex: 8, endColumnIndex: 9 },
        cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
  }

  // Send all formatting
  if (requests.length > 0) {
    await batchUpdate(auth, spreadsheetId, requests);
    console.log(`   Applied ${requests.length} formatting rules`);
  }

  // === BANDING for master sheet (try once, skip if exists) ===
  if (txnSheet) {
    try {
      await batchUpdate(auth, spreadsheetId, [{
        addBanding: {
          bandedRange: {
            range: { sheetId: txnSheet.sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 11 },
            rowProperties: {
              headerColor: COLORS.headerBg,
              firstBandColor: COLORS.white,
              secondBandColor: COLORS.altRow,
            },
          },
        },
      }]);
    } catch (e) {
      // Already exists - that's fine
    }
  }

  // === BANDING for monthly sheets ===
  for (const info of (monthlySheetInfo || [])) {
    if (!info.isNew) continue;
    try {
      await batchUpdate(auth, spreadsheetId, [{
        addBanding: {
          bandedRange: {
            range: { sheetId: info.sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 6 },
            rowProperties: {
              headerColor: COLORS.headerBg,
              firstBandColor: COLORS.white,
              secondBandColor: COLORS.altRow,
            },
          },
        },
      }]);
    } catch (e) {
      // Already exists - that's fine
    }
  }

  // === PIE CHARTS for new monthly sheets ===
  const chartRequests = [];
  for (const info of (monthlySheetInfo || [])) {
    if (!info.isNew || info.categoryCount === 0) continue;

    chartRequests.push({
      addChart: {
        chart: {
          spec: {
            title: 'חלוקת הוצאות לפי קטגוריה',
            pieChart: {
              legendPosition: 'LABELED_LEGEND',
              domain: {
                sourceRange: {
                  sources: [{
                    sheetId: info.sheetId,
                    startRowIndex: 1,
                    endRowIndex: 1 + info.categoryCount,
                    startColumnIndex: 7,
                    endColumnIndex: 8,
                  }],
                },
              },
              series: {
                sourceRange: {
                  sources: [{
                    sheetId: info.sheetId,
                    startRowIndex: 1,
                    endRowIndex: 1 + info.categoryCount,
                    startColumnIndex: 8,
                    endColumnIndex: 9,
                  }],
                },
              },
              threeDimensional: false,
            },
          },
          position: {
            overlayPosition: {
              anchorCell: {
                sheetId: info.sheetId,
                rowIndex: info.summaryStartRow + 5,
                columnIndex: 6,
              },
              widthPixels: 620,
              heightPixels: 400,
            },
          },
        },
      },
    });
  }

  if (chartRequests.length > 0) {
    try {
      await batchUpdate(auth, spreadsheetId, chartRequests);
      console.log(`   Added ${chartRequests.length} pie chart(s)`);
    } catch (e) {
      console.log('⚠️  Charts skipped:', e.message);
    }
  }
}

module.exports = { formatSheet };
