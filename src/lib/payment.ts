export interface PaymentInfo {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  qrisPayload: string | null;
}

type WithPayment = PaymentInfo & {
  user?: (Partial<PaymentInfo> & { name?: string | null }) | null;
};

/** Linked members use their own profile; guests use what was typed for them. */
export function paymentInfo(member: WithPayment): PaymentInfo {
  const u = member.user;
  return {
    bankName: u?.bankName ?? member.bankName ?? null,
    accountNumber: u?.accountNumber ?? member.accountNumber ?? null,
    accountHolder: u?.accountHolder ?? member.accountHolder ?? null,
    qrisPayload: u?.qrisPayload ?? member.qrisPayload ?? null,
  };
}

export function hasPaymentInfo(p: PaymentInfo) {
  return Boolean(p.accountNumber || p.qrisPayload);
}
