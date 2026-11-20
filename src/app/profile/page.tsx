import { requireUser } from "@/lib/access";
import { ProfileForm } from "./profile-form";
import { deleteAccount } from "@/app/actions";
import { ConfirmButton } from "@/components/confirm-button";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="muted mt-1">
          When you pay a bill, the people in your group see these details so they can pay you back. All payment
          fields are optional.
        </p>
      </div>
      <ProfileForm
        initial={{
          name: user.name ?? "",
          bankName: user.bankName ?? "",
          accountNumber: user.accountNumber ?? "",
          accountHolder: user.accountHolder ?? "",
          qrisPayload: user.qrisPayload ?? "",
        }}
        email={user.email}
      />
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Delete account</h2>
        <p className="muted">
          Removes your account and payment details. Bills in groups you share with others stay, under your name as a
          guest, so their balances remain correct. Groups where nobody else has an account are deleted with all their
          bills and photos.
        </p>
        <form action={deleteAccount}>
          <ConfirmButton message="Delete your account? This cannot be undone.">Delete my account</ConfirmButton>
        </form>
      </section>
    </div>
  );
}
