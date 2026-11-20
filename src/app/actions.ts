"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireMember, requireUser } from "@/lib/access";
import { splitItemized, splitSimple } from "@/lib/split";
import { isValidQris } from "@/lib/qris";
import { signIn, signOut } from "@/auth";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const optionalText = z
  .string()
  .trim()
  .max(100)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const accountNumber = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => v === "" || /^\d{5,20}$/.test(v), "Rek no should be 5 to 20 digits")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const qris = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidQris(v), "That QR isn't a valid QRIS code")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const paymentSchema = z.object({
  bankName: optionalText,
  accountNumber,
  accountHolder: optionalText,
  qrisPayload: qris,
});

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Invalid input";
}

/** Only allow redirects to our own pages. */
function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/groups";
}

/** Guest sign-in: just a name. Creates a new account stored in this browser. */
export async function signInAsGuest(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await signIn("guest", { name, redirectTo: safeNext(formData.get("next")) });
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safeNext(formData.get("next")) });
}

/** Sign in and come straight back to the invite page. */
export async function signInToJoin(inviteCode: string) {
  await signIn("google", { redirectTo: `/join/${encodeURIComponent(inviteCode)}` });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// ---------- profile ----------

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = paymentSchema.extend({ name: z.string().trim().min(1, "Name is required").max(60) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const { name, ...payment } = parsed.data;
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name, ...payment } }),
    prisma.groupMember.updateMany({ where: { userId: user.id }, data: { name } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Delete the signed-in account. Bills in shared groups stay (your spot becomes
 * a guest with your name) so other members' balances remain correct. Groups
 * where nobody else has an account are deleted completely.
 */
export async function deleteAccount() {
  const user = await requireUser();
  const memberships = await prisma.groupMember.findMany({ where: { userId: user.id }, select: { groupId: true } });
  const orphanGroupIds: string[] = [];
  for (const { groupId } of memberships) {
    const others = await prisma.groupMember.count({ where: { groupId, userId: { not: null, notIn: [user.id] } } });
    if (others === 0) orphanGroupIds.push(groupId);
  }
  const receipts = await prisma.expense.findMany({
    where: { groupId: { in: orphanGroupIds }, receiptUrl: { not: null } },
    select: { receiptUrl: true },
  });

  await signOut({ redirect: false });
  await prisma.$transaction([
    prisma.group.deleteMany({ where: { id: { in: orphanGroupIds } } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  await deleteBlobs(receipts.map((r) => r.receiptUrl!));
  redirect("/");
}

// ---------- groups ----------

export async function createGroup(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  const group = await prisma.group.create({
    data: {
      name,
      members: { create: { userId: user.id, name: user.name ?? user.email ?? "Me" } },
    },
  });
  redirect(`/groups/${group.id}`);
}

export async function renameGroup(groupId: string, formData: FormData) {
  await requireMember(groupId);
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  await prisma.group.update({ where: { id: groupId }, data: { name } });
  revalidatePath(`/groups/${groupId}`);
}

export async function deleteGroup(groupId: string) {
  await requireMember(groupId);
  const receipts = await prisma.expense.findMany({
    where: { groupId, receiptUrl: { not: null } },
    select: { receiptUrl: true },
  });
  await prisma.group.delete({ where: { id: groupId } });
  await deleteBlobs(receipts.map((r) => r.receiptUrl!));
  redirect("/groups");
}

export async function joinGroup(inviteCode: string) {
  const user = await requireUser();
  const group = await prisma.group.findUnique({ where: { inviteCode } });
  if (!group) redirect("/groups");
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    update: {},
    create: { groupId: group.id, userId: user.id, name: user.name ?? user.email ?? "Member" },
  });
  redirect(`/groups/${group.id}`);
}

/** Claim a guest spot ("I'm Budi") so past expenses link to your account. */
export async function claimGuest(groupId: string, guestId: string) {
  const { user, me } = await requireMember(groupId);
  const guest = await prisma.groupMember.findFirst({ where: { id: guestId, groupId, userId: null } });
  if (!guest) return;
  // Only a fresh membership (nothing recorded yet) can be swapped for a guest spot.
  const [paid, shares, sent, got] = await Promise.all([
    prisma.expense.count({ where: { paidById: me.id } }),
    prisma.expenseShare.count({ where: { memberId: me.id } }),
    prisma.settlement.count({ where: { fromId: me.id } }),
    prisma.settlement.count({ where: { toId: me.id } }),
  ]);
  if (paid + shares + sent + got > 0) return;
  await prisma.$transaction([
    prisma.groupMember.delete({ where: { id: me.id } }),
    prisma.groupMember.update({
      where: { id: guest.id },
      data: { userId: user.id, name: user.name ?? guest.name },
    }),
  ]);
  revalidatePath(`/groups/${groupId}`);
}

export async function addGuest(groupId: string, input: unknown): Promise<ActionResult> {
  await requireMember(groupId);
  const parsed = paymentSchema
    .extend({ name: z.string().trim().min(1, "Name is required").max(60) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const m = await prisma.groupMember.create({ data: { groupId, ...parsed.data } });
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, id: m.id };
}

export async function updateGuest(groupId: string, memberId: string, input: unknown): Promise<ActionResult> {
  await requireMember(groupId);
  const parsed = paymentSchema
    .extend({ name: z.string().trim().min(1, "Name is required").max(60) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const res = await prisma.groupMember.updateMany({
    where: { id: memberId, groupId, userId: null },
    data: parsed.data,
  });
  if (res.count === 0) return { ok: false, error: "Only guests can be edited here" };
  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

// ---------- expenses ----------

const money = z.number().int().min(0).max(1_000_000_000);

const expenseSchema = z.object({
  groupId: z.string(),
  expenseId: z.string().optional(),
  description: z.string().trim().min(1, "Add a description").max(120),
  date: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  paidById: z.string().min(1, "Pick who paid"),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENT", "SHARES", "ITEMIZED"]),
  category: optionalText,
  note: z.string().trim().max(500).optional(),
  receiptUrl: z.string().url().nullable().optional(),
  total: money.optional(),
  participants: z.array(z.object({ memberId: z.string(), value: z.number().int().min(0).optional() })).default([]),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Every item needs a name").max(80),
        quantity: z.number().int().min(1).max(999),
        price: money,
        assignees: z.array(z.string()),
      }),
    )
    .default([]),
  tax: money.default(0),
  service: money.default(0),
  discount: money.default(0),
});

export type ExpenseInput = z.input<typeof expenseSchema>;

export async function saveExpense(input: ExpenseInput): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const d = parsed.data;
  await requireMember(d.groupId);

  const members = await prisma.groupMember.findMany({ where: { groupId: d.groupId }, select: { id: true } });
  const memberIds = new Set(members.map((m) => m.id));
  const used = [d.paidById, ...d.participants.map((p) => p.memberId), ...d.items.flatMap((i) => i.assignees)];
  if (used.some((id) => !memberIds.has(id))) return { ok: false, error: "Someone in this expense isn't in the group" };

  let total: number;
  let shares: { memberId: string; amount: number; input: number | null }[];
  try {
    if (d.splitType === "ITEMIZED") {
      if (d.items.length === 0) return { ok: false, error: "Add at least one item" };
      const r = splitItemized({ items: d.items, tax: d.tax, service: d.service, discount: d.discount });
      if (r.total < 0) return { ok: false, error: "Discount is bigger than the bill" };
      total = r.total;
      shares = Object.entries(r.perMember).map(([memberId, m]) => ({ memberId, amount: m.total, input: null }));
    } else {
      if (!d.total) return { ok: false, error: "Enter the total amount" };
      total = d.total;
      const result = splitSimple({ type: d.splitType, total, participants: d.participants });
      shares = d.participants.map((p) => ({
        memberId: p.memberId,
        amount: result[p.memberId],
        input: d.splitType === "EQUAL" ? null : (p.value ?? 0),
      }));
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't split this expense" };
  }

  const data = {
    description: d.description,
    date: new Date(d.date),
    paidById: d.paidById,
    splitType: d.splitType,
    total,
    tax: d.splitType === "ITEMIZED" ? d.tax : 0,
    service: d.splitType === "ITEMIZED" ? d.service : 0,
    discount: d.splitType === "ITEMIZED" ? d.discount : 0,
    receiptUrl: d.receiptUrl ?? null,
    category: d.category ?? null,
    note: d.note || null,
  };

  let oldReceipt: string | null = null;
  const id = await prisma.$transaction(async (tx) => {
    let expenseId = d.expenseId;
    if (expenseId) {
      const existing = await tx.expense.findFirst({ where: { id: expenseId, groupId: d.groupId } });
      if (!existing) throw new Error("Expense not found");
      if (existing.receiptUrl && existing.receiptUrl !== data.receiptUrl) oldReceipt = existing.receiptUrl;
      await tx.expense.update({ where: { id: expenseId }, data });
      await tx.expenseItem.deleteMany({ where: { expenseId } });
      await tx.expenseShare.deleteMany({ where: { expenseId } });
    } else {
      expenseId = (await tx.expense.create({ data: { ...data, groupId: d.groupId } })).id;
    }
    for (const [position, item] of d.items.entries()) {
      if (d.splitType !== "ITEMIZED") break;
      await tx.expenseItem.create({
        data: {
          expenseId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          position,
          assignees: { create: [...new Set(item.assignees)].map((memberId) => ({ memberId })) },
        },
      });
    }
    await tx.expenseShare.createMany({ data: shares.map((s) => ({ ...s, expenseId: expenseId! })) });
    return expenseId;
  });

  if (oldReceipt) await deleteBlobs([oldReceipt]);
  revalidatePath(`/groups/${d.groupId}`);
  return { ok: true, id };
}

export async function deleteExpense(groupId: string, expenseId: string) {
  await requireMember(groupId);
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, groupId } });
  if (!expense) return;
  await prisma.expense.delete({ where: { id: expenseId } });
  if (expense.receiptUrl) await deleteBlobs([expense.receiptUrl]);
  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}

// ---------- settle up ----------

export async function recordSettlement(input: {
  groupId: string;
  fromId: string;
  toId: string;
  amount: number;
  expenseId?: string;
}): Promise<ActionResult> {
  await requireMember(input.groupId);
  if (!Number.isInteger(input.amount) || input.amount <= 0) return { ok: false, error: "Invalid amount" };
  if (input.fromId === input.toId) return { ok: false, error: "Pick two different people" };
  const count = await prisma.groupMember.count({
    where: { groupId: input.groupId, id: { in: [input.fromId, input.toId] } },
  });
  if (count !== 2) return { ok: false, error: "Member not found" };
  await prisma.settlement.create({ data: input });
  revalidatePath(`/groups/${input.groupId}`, "layout");
  return { ok: true };
}

export async function deleteSettlement(groupId: string, settlementId: string) {
  await requireMember(groupId);
  await prisma.settlement.deleteMany({ where: { id: settlementId, groupId } });
  revalidatePath(`/groups/${groupId}`, "layout");
}

// ---------- helpers ----------

async function deleteBlobs(urls: string[]) {
  if (!urls.length || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    await del(urls);
  } catch {
    // a missing blob shouldn't break the action
  }
}
