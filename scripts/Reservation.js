// @param {Range} refRange - The refferenced range.
// @param {Integer} [numDigits=6] - The number of digits for IDs.
// @returns {String} - A number that is unique within `refRange`.
function _makeUniqueIdInRange(refRange, numDigits) {
    numDigits = numDigits || 6;

    var idMax = Math.pow(10, numDigits);
    if (refRange.getHeight() >= idMax) {
        throw new Error('The number of ids has reached the limit.');
    }

    var templateStr = Utilities.formatString('%%0%dd', numDigits);
    while (true) {
        var uniqueId = Utilities.formatString('%06d', Math.floor(Math.random() * idMax));
        if (_isUniqueInRange(uniqueId, refRange)) {
            return uniqueId;
        }
    }
}

// @param {Sheet} reservSheet - The sheet object for reservations.
// @param {Integer} row - The row number to update (starting with 1).
// @param {Object[]} items - The array of items.
// @returns {String} - The reservation ID.
function _registerReservation(reservSheet, row, items) {
    var reservIdCol = _getColumnByNameOfSheet('予約番号', reservSheet);
    var reservIdsRange = reservSheet.getRange(1, reservIdCol, reservSheet.getLastRow() - 1);
    var reservId = _makeUniqueIdInRange(reservIdsRange);

    var targetRange = reservSheet.getRange(row, 1, 1, reservSheet.getLastColumn());
    var lines = targetRange.getValues();

    lines[0][reservIdCol - 1] = '\'' + reservId;
    items.some(function(item) {
        var itemCol = _getColumnByNameOfSheet(item.name, reservSheet);
        lines[0][itemCol - 1] = item.count;
    });

    // Update the row
    targetRange.setValues(lines);

    return reservId;
}

// @params {Sheet} itemSheet - The sheet object of items.
// @praram {Object} itemCounts - The key-value pairs of item counts.
// @returns {Object[]} - The array of items.
function _parseItems(itemSheet, itemCounts) {
    // Build item dictionaries
    var [nameCol, priceCol] = _getColumnsByNameOfSheet(['商品名', '単価'], itemSheet);
    var values = itemSheet.getDataRange().getValues().slice(1);
    var items = [];

    for (var row in values) {
        var name = values[row][nameCol - 1];
        var price = values[row][priceCol - 1];
        var count = itemCounts[name] && itemCounts[name].toString().replace(/^(\d+)個$/, '$1');

        items.push({
            name: name,
            price: price,
            count: parseInt(count) || 0
        });
    }

    return items;
}

// @param {Sheet} itemSheet - The sheet object of items.
// @returns {Object[]} - The array of reservations.
function _getReservationSummary(itemSheet) {
    var [nameCol, plannedCol, actualCol] =
        _getColumnsByNameOfSheet(['商品名', '予約数（予定）', '予約数（確定）'], itemSheet);
    var values = itemSheet.getDataRange().getValues().slice(1);
    var reservSumm = [];

    for (var row in values) {
        var name = values[row][nameCol - 1];
        var planned = values[row][plannedCol - 1];
        var actual = values[row][actualCol - 1];

        reservSumm.push({
            name: name,
            planned: planned,
            actual: actual
        });
    }

    return reservSumm;
}

// @param {Object[]} reservSumm - The array of reservations
function _notifyReservationSummary(reservSumm) {
    // Build HTML from template file
    var html = HtmlService.createTemplateFromFile('email_alarm');
    html.reservSumm = reservSumm;

    var email = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({
        to: email,
        name: PUBLISHER_SIGNATURE,
        subject: Utilities.formatString('【予約数アラート】%s', PUBLISHER_SIGNATURE),
        htmlBody: html.evaluate().getContent()
    });
}

function _clearNotifiedDate() {
    PropertiesService.getScriptProperties().deleteProperty('NOTIFIED_DATE');
    Logger.log('The notified date successfully cleared.');
}

// @param {String} reservId - The reservation ID.
// @returns {Blob} - The blob of the QR code.
function _makeQRCode(reservId) {
    var longUrl = Utilities.formatString(
        'https://script.google.com/macros/s/%s/exec?rid=%s',
        ScriptApp.getScriptId(),
        reservId
    );

    var shortUrl = Utilities.formatString(
        'https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=%s',
        _shortenUrl(longUrl)
    );

    var response = UrlFetchApp.fetch(shortUrl);
    return response.getBlob();
}

// @param {Event} e - The event object.
function onFormSubmit(e) {
    var reservSheet = e.range.getSheet();
    var itemSheet = reservSheet.getParent().getSheetByName(ITEM_SHEET_NAME);

    // Parse items from the event object
    var items = _parseItems(itemSheet, e.namedValues);

    // Register the reservation
    var reservId = _registerReservation(reservSheet, e.range.getRow(), items);

    // Notify me if the number of reservations exceeds the threshold
    var reservSumm = _getReservationSummary(itemSheet);
    var shouldNotify = reservSumm.reduce(function (prevResult, reserv) {
        if (reserv.actual >= reserv.planned) {
            var properties = PropertiesService.getScriptProperties();
            var notifiedDates = JSON.parse(properties.getProperty(PROP_NOTIFIED_DATE) || '{}');
            var notifiedDate = new Date(notifiedDates[reserv.name] || null);
            var now = new Date();

            // Notification is limited to 1 time per day
            if ((now - notifiedDate) > 24 * 60 * 60 * 1000) {
                notifiedDates[reserv.name] = now.toISOString();
                properties.setProperty(PROP_NOTIFIED_DATE, JSON.stringify(notifiedDates));
                return true;
            } else {
                return prevResult;
            }
        }
    }, false);

    if (shouldNotify) {
        _notifyReservationSummary(reservSumm);
    }

    // Build HTML from template file
    var html = HtmlService.createTemplateFromFile('email_confirm');
    html.customName = e.namedValues['お名前'].toString();
    html.items = items;
    html.reservId = reservId;

    // Send e-mail to the customer
    MailApp.sendEmail({
        to: e.namedValues['メールアドレス'].toString(),
        name: PUBLISHER_SIGNATURE,
        subject: Utilities.formatString('【予約確認】%s', PUBLISHER_SIGNATURE),
        htmlBody: html.evaluate().getContent(),
        inlineImages: {
            qrCode: _makeQRCode(reservId)
        }
    });
}