import Link from "next/link";
import { ContactLine, LegalPage, LegalSection } from "@/components/legal";
import { site } from "@/lib/site";
import { googleEnabled } from "@/auth";
import { smartScanEnabled } from "@/lib/ai-receipt";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what information {site.name} ({site.url.replace(/^https?:\/\//, "")}) collects, why, who
        can see it and how you can have it removed. {site.name} is operated by {site.operator}. You can reach us at{" "}
        <ContactLine />.
      </p>

      <LegalSection title="Information we collect">
        <p>When you start with just your name, we store that name and nothing else about you.</p>
        {googleEnabled && (
          <>
            <p>If you choose to sign in with Google instead, we receive and store:</p>
            <ul>
              <li>your name, email address and profile picture link;</li>
              <li>your Google account identifier and the sign-in tokens Google issues, used only to keep you signed in.</li>
            </ul>
          </>
        )}
        <p>When you use the app, we store what you and your group members enter:</p>
        <ul>
          <li>group names, member names (including people added without an account) and invite links;</li>
          <li>bills: description, date, items, prices, who had each item, tax, service, discount, notes;</li>
          <li>payments recorded between members;</li>
          <li>
            optional payment details: bank or e-wallet name, account number, account holder name and the text
            contained in a QRIS code (not the QRIS image);
          </li>
          <li>receipt photos you choose to upload.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul>
          <li>to sign you in and keep your groups and bills in your account;</li>
          <li>to calculate each person&apos;s share and show who to pay back;</li>
          <li>to show the payer&apos;s account number and QRIS to the members of the same group.</li>
        </ul>
        <p>We do not sell your information, show advertising or use your information to build marketing profiles.</p>
      </LegalSection>

      <LegalSection title="Who can see your information">
        <ul>
          <li>
            Members of a group can see that group&apos;s members, bills, receipt photos and recorded payments, and the
            payment details of anyone who paid a bill in that group.
          </li>
          <li>Anyone with a group&apos;s invite link can see the group name and member count, and can join after signing in.</li>
          <li>
            Receipt photos are stored at long, randomly generated web addresses. They are not listed anywhere, but anyone
            who has the exact address can open the photo. Do not upload photos showing card numbers or other sensitive
            details.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Receipt scanning">
        {smartScanEnabled ? (
          <>
            <p>
              When you tap &quot;Smart scan&quot;, the receipt photo is sent to Google&apos;s Gemini API, which reads the
              items and amounts and sends them back to fill in the bill. We use Gemini&apos;s free tier, under which Google
              may use what is sent to improve its products, and people at Google may review it. Do not use Smart scan on
              receipts that show sensitive details such as full card numbers.
            </p>
            <p>
              If Smart scan is unavailable, the app falls back to reading the photo in your browser. In that case the
              photo is not sent anywhere for scanning; your browser downloads the scanning software and language files
              from the jsDelivr public CDN (cdn.jsdelivr.net) the first time.
            </p>
          </>
        ) : (
          <p>
            Scanning a receipt happens in your browser. The photo is not sent to us or to any other service for scanning.
            The first time you scan, your browser downloads the scanning software and language files from the jsDelivr
            public CDN (cdn.jsdelivr.net).
          </p>
        )}
      </LegalSection>

      <LegalSection title="Service providers">
        <p>We use these providers to run {site.name}. They process data on our behalf:</p>
        <ul>
          <li>Vercel: website hosting and receipt photo storage (Vercel Blob);</li>
          <li>Prisma: database hosting (Prisma Postgres);</li>
          {googleEnabled && <li>Google: optional sign-in.</li>}
          {smartScanEnabled && <li>Google: reading receipt photos with the Gemini API (Smart scan).</li>}
        </ul>
        <p>These providers may store data on servers outside Indonesia.</p>
      </LegalSection>

      <LegalSection title="Cookies and local storage">
        <p>
          We use one essential cookie to keep you signed in. It is encrypted and holds your account identifier and
          name. The sign-in process also sets short-lived security cookies. Your
          light or dark mode choice is saved in your browser&apos;s local storage. We do not use analytics, advertising
          or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <ul>
          <li>Bills and their receipt photos are kept until a group member deletes the bill or the group.</li>
          <li>Payment details are kept until you remove them in your profile or delete your account.</li>
          <li>
            Accounts created with just a name live in your browser&apos;s cookie. If you clear your cookies or switch
            device, you will not be able to get back into that account, but its data stays on our servers until a
            group member deletes it or you ask us to.
          </li>
          <li>
            When you delete your account in your <Link href="/profile" className="link">profile</Link>, your account,
            sign-in data and payment details are deleted. Bills in groups you share with others stay under your name so
            those members&apos; balances remain correct. Groups where nobody else has an account are deleted entirely.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can view and correct your information in the app at any time. You can also ask us to provide, correct or
          delete your personal data, or to stop processing it, as provided under Indonesia&apos;s Personal Data
          Protection Law (Law No. 27 of 2022). Email <ContactLine /> and we will respond as soon as we can.
        </p>
        <p>
          If someone added your name or payment details to a group without your permission, contact us and we will
          remove them.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Data is sent over encrypted connections (HTTPS). Access to groups is limited to their members. No online
          service is perfectly secure, so please only store the information you need.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>{site.name} is intended for adults. Do not use it if you are under 18 without a parent or guardian&apos;s permission.</p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If we change this policy, we will update the date at the top of this page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
