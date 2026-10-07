import styles from "./privacy.module.css";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · Akaal Team Management",
  description: "How Akaal Team Management (ATM) collects, uses, and protects data.",
};

const CONTACT = "admin@akaal.id";
const UPDATED = "7 October 2026";

/** Public privacy policy (also the link Google's OAuth consent screen requires). */
export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.doc}>
        <header className={styles.header}>
          <Image src="/icon/atm-icon-192.png" alt="" width={40} height={40} priority />
          <div>
            <p className={styles.eyebrow}>Akaal Team Management</p>
            <h1 className={styles.title}>Privacy Policy</h1>
            <p className={styles.meta}>Last updated {UPDATED}</p>
          </div>
        </header>

        <p>
          Akaal Team Management (&quot;ATM&quot;, available at <a href="https://team.akaal.id">team.akaal.id</a>) is an internal workspace that Akaal provides to its team
          members for tasks, projects, attendance, messaging, and file sharing. This policy explains what data ATM handles and why.
        </p>

        <h2>Data we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong> — your name, work email, role, department, and profile photo. If you sign in with Google, we receive your name, email address, and
            profile picture from your Google account for sign-in only.
          </li>
          <li>
            <strong>Work data</strong> — tasks, projects, checklists, comments, chat messages, announcements, leave requests, and similar content you or your teammates create.
          </li>
          <li>
            <strong>Attendance</strong> — clock-in and clock-out times and the device location captured at those moments, plus the home location you choose to set, used to mark a
            day as office, home, or off-site.
          </li>
          <li>
            <strong>Files</strong> — files and folders you upload from ATM are stored in Akaal&apos;s company Google Drive and linked to the related task or project.
          </li>
          <li>
            <strong>Technical data</strong> — sign-in sessions, notification (push) subscriptions for your devices, and basic logs needed to keep the service secure and working.
          </li>
        </ul>

        <h2>How we use it</h2>
        <p>
          Only to run ATM for Akaal&apos;s team: authenticating you, showing and organising work, attendance and performance reporting, sending notifications and account emails, and
          keeping the service secure. We do not sell personal data or use it for advertising.
        </p>

        <h2>Google user data</h2>
        <p>
          Google sign-in uses only basic profile scopes (name, email, profile picture) to identify you. ATM does not read, change, or store files in your personal Google Drive —
          uploads go to Akaal&apos;s own company Drive. ATM&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>

        <h2>Who processes the data</h2>
        <p>
          ATM runs on trusted service providers acting on Akaal&apos;s behalf: Supabase (database), Vercel (hosting), Google (sign-in and Drive storage), and Resend (email delivery).
          Data is shared with them only as needed to operate the service. Within Akaal, data is visible to teammates according to their role and permissions.
        </p>

        <h2>Retention and your choices</h2>
        <p>
          Data is kept while your account is active and as long as needed for Akaal&apos;s work records. You can ask to see, correct, or delete your personal data, or to close your
          account, by contacting us below. You can turn off notifications or location access in your browser or device settings at any time.
        </p>

        <h2>Security</h2>
        <p>Access requires an authenticated account, traffic is encrypted (HTTPS), and permissions limit what each role can see and change.</p>

        <h2>Contact</h2>
        <p>
          Questions about this policy or your data: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <footer className={styles.footer}>
          <Link href="/login">← Back to ATM</Link>
        </footer>
      </article>
    </main>
  );
}
