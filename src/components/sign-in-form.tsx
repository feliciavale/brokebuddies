import { googleEnabled } from "@/auth";
import { signInAsGuest, signInWithGoogle } from "@/app/actions";
import { SubmitButton } from "./submit-button";

/** Google sign-in (when configured) plus name-only guest sign-in. */
export function SignInForm({ next = "/groups", submitLabel = "Continue as guest" }: { next?: string; submitLabel?: string }) {
  return (
    <div className="space-y-4">
      {googleEnabled && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
             <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Opening Google...">
              Continue with Google
            </SubmitButton>
          </form>
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Or just use your name</p>
        </>
      )}
      <form action={signInAsGuest} className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="guest-name" className="sr-only">
          Your name
        </label>
        <input
          id="guest-name"
          name="name"
          className="input sm:max-w-64"
          placeholder="Your name"
          autoComplete="given-name"
          required
          maxLength={60}
        />
        <button className={googleEnabled ? "btn" : "btn-primary"} type="submit">
          {submitLabel}
        </button>
      </form>
      <p className="text-xs text-muted">
        Guest accounts need no password and are saved in this browser only. Use Google to sign in from any device.
      </p>
    </div>
  );
}