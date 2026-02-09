// Sheet formatting - RTL, colors, clean layout

const COLORS = {
  headerBg: { red: 0.15, green: 0.35, blue: 0.6 },       // כחול כהה
  headerText: { red: 1, green: 1, blue: 1 },               // לבן
  altRowBg: { red: 0.93, green: 0.95, blue: 0.98 },        // תכלת בהיר
  greenBg: { red: 0.85, green: 0.95, blue: 0.85 },         // ירוק בהיר
  yellowBg: { red: 1, green: 0.97, blue: 0.8 },            // צהוב בהיר
  orangeBg: { red: 1, green: 0.9, blue: 0.8 },             // כתום בהיר
  redBg: { red: 1, green: 0.85, blue: 0.85 },              // אדום בהיר
  white: { red: 1, green: 1, blue: 1 },
};

async function formatSheet(doc) {
  const requests = [];

  for (const sheet of doc.sheetsByIndex) {
    const sheetId = sheet.sheetId;

    // Set RTL direction
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, rightToLeft: true },
        fields: 'rightToLeft',
      },
    });

    // Format header row
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.headerBg,
            textFormat: {
              foregroundColor: COLORS.headerText,
              bold: true,
              fontSize: 11,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });

    // Freeze header row
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });

    // Set header row height
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: 'pixelSize',
      },
    });
  }

  // Format transactions sheet - hide "מזהה" column (last column)
  const txnSheet = doc.sheetsByTitle['עסקאות'];
  if (txnSheet) {
    const sheetId = txnSheet.sheetId;

    // Auto resize columns
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 11 },
      },
    });

    // Hide מזהה column (index 11)
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 11, endIndex: 12 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    });

    // Alternating row colors for data rows
    requests.push({
      addBanding: {
        bandedRange: {
          sheetId,
          range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 11 },
          rowProperties: {
            headerColor: COLORS.headerBg,
            firstBandColor: COLORS.white,
            secondBandColor: COLORS.altRowBg,
          },
        },
      },
    });
  }

  // Format summary sheet with conditional coloring
  const summarySheet = doc.sheetsByTitle['סיכום חודשי'];
  if (summarySheet) {
    const sheetId = summarySheet.sheetId;

    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 6 },
      },
    });
  }

  // Format categories sheet
  const catSheet = doc.sheetsByTitle['לפי קטגוריה'];
  if (catSheet) {
    const sheetId = catSheet.sheetId;

    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 },
      },
    });
  }

  if (requests.length > 0) {
    await doc.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: doc.spreadsheetId,
      requestBody: { requests },
    });
  }
}

module.exports = { formatSheet };
