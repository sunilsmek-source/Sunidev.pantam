/**
 * ======================================================================
 * PANTOMIC AI — GOOGLE SHEETS AUTOMATIC SYNC SCRIPT
 * ======================================================================
 * 
 * Yeh Google Apps Script aapke Google Sheet me Pantomic website se
 * aane wale saare user signups ko automatically record karega.
 * 
 * GOOGLE SHEET ME EXACT COLUMNS ORDER:
 * ----------------------------------------------------------------------
 * Column A : User ID
 * Column B : Full Name
 * Column C : Email ID
 * Column D : Mobile Number
 * Column E : Password (Plain text)
 * Column F : Market Selected
 * Column G : Signup Date
 * Column H : Plan (Free / Premium)
 * ----------------------------------------------------------------------
 * 
 * SETUP KAISE KAREIN (Only 2 Minutes):
 * 1. Google Sheets open karein (https://sheets.new)
 * 2. Row 1 me chahein toh upar diye gaye 8 headers khud daal dein (ya script khud bana dega)
 * 3. Upar menu me Extensions -> Apps Script par click karein.
 * 4. Pura purana code hata kar yeh code paste kar dein aur Save (Ctrl+S) karein.
 * 5. Upar right side "Deploy" -> "New deployment" par click karein.
 * 6. Gear icon ⚙️ par click karke "Web app" choose karein.
 * 7. Execute as: "Me"
 * 8. Who has access: "Anyone" (Zaroori hai!)
 * 9. "Deploy" button dabayein aur authorization allow karein.
 * 10. Jo Web App URL milega, use copy karke Pantomic Settings me daal dein!
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // 10 second lock to avoid concurrent write collisions

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var contents = e.postData.contents;
    var data = JSON.parse(contents);

    // Agar sheet khali hai toh headers create karein
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "User ID",
        "Full Name",
        "Email ID",
        "Mobile Number",
        "Password",
        "Market Selected",
        "Signup Date",
        "Plan"
      ]);

      // Header styling (Emerald Fintech Green)
      var headerRange = sheet.getRange(1, 1, 1, 8);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#10B981");
      headerRange.setFontColor("#FFFFFF");
    }

    // New user row append karein exact columns me:
    sheet.appendRow([
      data.userId || ("PANTO-" + Math.floor(10000 + Math.random() * 90000)), // Col A
      data.name || "",                                                         // Col B
      data.email || "",                                                        // Col C
      "'" + (data.mobile || ""),                                               // Col D (Leading zero preserved)
      data.password || "",                                                     // Col E (Plain text per requirement)
      data.markets || "",                                                      // Col F
      data.signupDate || new Date().toLocaleDateString('en-GB'),               // Col G
      data.plan || "Free"                                                      // Col H
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "User registered in Google Sheet successfully!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";
  
  // Real-Time Market Feed Proxy for Pantomic AI (Nifty 50, Sensex, Bank Nifty, Stocks)
  if (action === "market") {
    try {
      var symbol = (e.parameter.symbol) ? e.parameter.symbol : "^NSEI";
      var url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol);
      var response = UrlFetchApp.fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        muteHttpExceptions: true
      });
      return ContentService.createTextOutput(response.getContentText())
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput("Pantomic Google Sheet Webhook is active and listening!");
}
