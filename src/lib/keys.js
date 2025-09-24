// @ts-check
const crypto = require("crypto");

/** Opaque key, no filename/PHI */
function makeOpaqueKey({ appointmentId, senderId }) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `transfers/${d}/${appointmentId}/${crypto.randomUUID()}`;
}

function sanitizeDownloadName(name) {
  return (
    String(name)
      .replace(/[^\w.\-()+\s]/g, "_")
      .slice(0, 120) || "file"
  );
}

module.exports = { makeOpaqueKey, sanitizeDownloadName };



