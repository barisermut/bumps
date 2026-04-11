/**
 * Decode Cursor agent store.db `meta` row value (key "0").
 * Cursor has shipped multiple encodings; we try each strategy until JSON parses.
 *
 * Strategies (order):
 * 1. UTF-8 string from Buffer or string → JSON.parse
 * 2. Treat entire value as hexadecimal ASCII → decode → JSON.parse
 * 3. Trimmed UTF-8 retry (whitespace-only noise)
 */

function tryJsonParse(str) {
  if (str == null || typeof str !== "string") return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function hexToUtf8(hex) {
  if (!hex || typeof hex !== "string" || hex.length % 2 !== 0) return null;
  let out = "";
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    out += String.fromCharCode(byte);
  }
  return out;
}

function valueToUtf8String(value) {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return String(value);
}

function valueToHexString(value) {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("hex");
  return Buffer.from(String(value)).toString("hex");
}

/**
 * @param {unknown} rawValue - row.value from meta table
 * @returns {object|null} Parsed meta object or null
 */
function readStoreMetaValue(rawValue) {
  if (rawValue == null) return null;

  const utf8 = valueToUtf8String(rawValue);
  const fromUtf8 = tryJsonParse(utf8);
  if (fromUtf8 && typeof fromUtf8 === "object") return fromUtf8;

  const fromTrimmed = tryJsonParse(utf8.trim());
  if (fromTrimmed && typeof fromTrimmed === "object") return fromTrimmed;

  const hex = valueToHexString(rawValue);
  const decoded = hexToUtf8(hex);
  if (decoded) {
    const fromHex = tryJsonParse(decoded);
    if (fromHex && typeof fromHex === "object") return fromHex;
  }

  return null;
}

/**
 * @param {{ value: unknown }|null|undefined} row
 */
function decodeStoreMetaRow(row) {
  if (!row) return null;
  return readStoreMetaValue(row.value);
}

module.exports = {
  readStoreMetaValue,
  decodeStoreMetaRow,
  tryJsonParse,
};
