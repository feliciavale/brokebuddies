/**
 * QRIS (EMVCo merchant-presented QR) helpers.
 * A personal QRIS from GoPay / DANA / OVO / a bank app is "static":
 * the payer types the amount. We can turn it into a QR with the amount
 * pre-filled by adding tag 54 and recomputing the CRC.
 * Not every payment app honours an amount on a personal QRIS, so the UI
 * always shows the amount as text too.
 */

type Tlv = { tag: string; value: string };

export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseTlv(payload: string): Tlv[] {
  const out: Tlv[] = [];
  let i = 0;
  while (i < payload.length) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (tag.length < 2 || Number.isNaN(len)) throw new Error("Invalid QRIS data");
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length !== len) throw new Error("Invalid QRIS data");
    out.push({ tag, value });
    i += 4 + len;
  }
  return out;
}

function serialize(tlvs: Tlv[]): string {
  return tlvs.map((t) => t.tag + String(t.value.length).padStart(2, "0") + t.value).join("");
}

/** True if the text looks like a valid QRIS / EMVCo payload with a correct CRC. */
export function isValidQris(payload: string): boolean {
  try {
    const p = payload.trim();
    if (!p.startsWith("000201")) return false;
    const tlvs = parseTlv(p);
    const crc = tlvs.find((t) => t.tag === "63");
    if (!crc) return false;
    const body = p.slice(0, p.length - 4);
    return crc16(body) === crc.value.toUpperCase();
  } catch {
    return false;
  }
}

/** Merchant / account name inside the QRIS (tag 59), if any. */
export function qrisName(payload: string): string | null {
  try {
    return parseTlv(payload.trim()).find((t) => t.tag === "59")?.value ?? null;
  } catch {
    return null;
  }
}

/** Return a new QRIS payload with the transfer amount (whole rupiah) filled in. */
export function qrisWithAmount(payload: string, amount: number): string {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Amount must be a positive integer");
  const tlvs = parseTlv(payload.trim()).filter((t) => t.tag !== "63" && t.tag !== "54");
  const method = tlvs.find((t) => t.tag === "01");
  if (method) method.value = "12"; // 11 = static, 12 = dynamic (one-off amount)
  tlvs.push({ tag: "54", value: String(amount) });
  tlvs.sort((a, b) => Number(a.tag) - Number(b.tag));
  const body = serialize(tlvs) + "6304";
  return body + crc16(body);
}
