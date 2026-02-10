// Sheet formatting - RTL, colors, clean layout
// Uses google-auth-library JWT.request() for direct Google Sheets API calls

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

const COLORS = {
  headerBg: { red: 0.15, green: 0.35, blue: 0.6 },       // כחול כהה
  headerText: { red: 1, green: 1, blue: 1 },               // לבן
  altRowBg: { red: 0.93, green: 0.95, blue: 0.98 },        // תכלת בהיר
  white: { red: 1, green: 1, blue: 1 },
};

async function batchUpdate(auth, spreadsheetId, requests) {
  await auth.request({
    url: `${SHEETS_API}/${spreadsheetId}:batchUpdate`,
    method: 'POST',
    data: { requests },
  });
}

async function formatSheet(doc, auth) {
  const spreadsheetId = doc.spreadsheetId;
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

    // Format header row - blue background, white bold text
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

  // Transactions sheet - auto resize + hide identifier column
  const txnSheet = doc.sheetsByTitle['עסקאות'];
  if (txnSheet) {
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId: txnSheet.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 11 },
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: txnSheet.sheetId, dimension: 'COLUMNS', startIndex: 11, endIndex: 12 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    });
  }

  // Summary sheet - auto resize
  const summarySheet = doc.sheetsByTitle['סיכום חודשי'];
  if (summarySheet) {
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId: summarySheet.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 6 },
      },
    });
  }

  // Categories sheet - auto resize
  const catSheet = doc.sheetsByTitle['לפי קטגוריה'];
  if (catSheet) {
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId: catSheet.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 },
      },
    });
  }

  // Send all formatting requests in one batch
  if (requests.length > 0) {
    await batchUpdate(auth, spreadsheetId, requests);
    console.log(`   Applied ${requests.length} formatting rules`);
  }

  // Banding (alternating row colors) - separate call because it fails if already exists
  if (txnSheet) {
    try {
      await batchUpdate(auth, spreadsheetId, [{
        addBanding: {
          bandedRange: {
            range: {
              sheetId: txnSheet.sheetId,
              startRowIndex: 0,
              startColumnIndex: 0,
              endColumnIndex: 11,
            },
            rowProperties: {
              headerColor: COLORS.headerBg,
              firstBandColor: COLORS.white,
              secondBandColor: COLORS.altRowBg,
            },
          },
        },
      }]);
      console.log('   Applied alternating row colors');
    } catch (e) {
      // Banding already exists from a previous run - that's fine
      console.log('   Alternating row colors already applied');
    }
  }
}

module.exports = { formatSheet };
