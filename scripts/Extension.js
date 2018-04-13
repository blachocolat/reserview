// Number.prototype

if (!Number.prototype.commaSeparated) {
    Number.prototype.commaSeparated = function () {
        return String(this).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    }
}

// Date.prototype

if (!Date.prototype.getDayOfWeek) {
    Date.prototype.getDayOfWeek = function () {
        return ['日', '月', '火', '水', '木', '金', '土'][this.getDay()];
    }
}