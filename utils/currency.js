/**
 * Currency Utility for Moyasar (Halalah conversion)
 */

/**
 * Converts Saudi Riyal to Halalah
 * @param {number|string} amount - Amount in SAR
 * @returns {number} Amount in Halalah
 */
const toHalalah = (amount) => {
    if (isNaN(amount)) return 0;
    return Math.round(parseFloat(amount) * 100);
};

/**
 * Converts Halalah to Saudi Riyal
 * @param {number} halalah - Amount in Halalah
 * @returns {number} Amount in SAR
 */
const toSAR = (halalah) => {
    if (isNaN(halalah)) return 0;
    return halalah / 100;
};

module.exports = {
    toHalalah,
    toSAR,
};
