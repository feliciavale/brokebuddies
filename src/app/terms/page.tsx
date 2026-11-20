import Link from "next/link";
import { ContactLine, LegalPage, LegalSection } from "@/components/legal";
import { site } from "@/lib/site";
import { googleEnabled } from "@/auth";

export const metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions">
      <p>
        These terms apply to your use of {site.name}, operated by {site.operator}. By signing in or using the site you
        agree to them. If you do not agree, please do not use {site.name}. Questions can be sent to <ContactLine />.
      </p>

      <LegalSection title="What the service does">
        <p>
          {site.name} helps a group of people work out how to split a bill and shows each person how much to pay back
          and to whom. It is free to use.
        </p>
        <p>
          <b>{site.name} does not move money.</b> It does not hold funds, process payments or connect to your bank. All
          transfers and QRIS payments happen in your own banking or e-wallet app, between you and the person you pay.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <ul>
          {googleEnabled && <li>You can sign in with a Google account, which works on any device.</li>}
          <li>
            You can also start with just a name. That account is saved in your browser; if you clear cookies or
            switch device you cannot get back into it.
          </li>
          <li>You are responsible for activity under your account and for using your own name.</li>
          <li>Keep the details you enter accurate, including any bank account number or QRIS you add.</li>
          <li>You can delete your account at any time from your profile.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Check before you pay">
        <ul>
          <li>
            Receipt scanning can misread names and prices. Check the items and amounts against the receipt before saving
            a bill.
          </li>
          <li>
            Before sending money, confirm the account holder name shown in your banking or e-wallet app is the person you
            intend to pay.
          </li>
          <li>Payments marked as paid in {site.name} are a record only. They do not confirm that money was received.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Adding other people">
        <p>
          You may add people to a group who do not have an account. Only add a person&apos;s name or payment details if
          you have their permission.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>use {site.name} for fraud, to request money you are not owed, or for any unlawful purpose;</li>
          <li>upload content that is unlawful or that you do not have the right to share;</li>
          <li>try to access groups you are not a member of, or disrupt or overload the service.</li>
        </ul>
        <p>We may remove content or suspend accounts that break these terms.</p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You keep ownership of what you enter and upload. You allow us to store and display it to the members of your
          groups so the service can work. Our <Link href="/privacy" className="link">Privacy Policy</Link> explains how
          we handle it.
        </p>
      </LegalSection>

      <LegalSection title="Availability">
        <p>
          {site.name} is provided free of charge, as is and as available. We may change, pause or stop the service at
          any time.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the extent permitted by law, {site.operator} is not liable for losses arising from your use of {site.name},
          including incorrect amounts, payments sent to the wrong account, disagreements between group members, or loss
          of data. You are responsible for checking amounts and payment details before you pay.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>These terms are governed by the laws of the Republic of Indonesia.</p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          If we change these terms, we will update the date at the top of this page. Continuing to use {site.name} after
          a change means you accept the updated terms.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
