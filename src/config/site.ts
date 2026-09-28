/**
 * Static, non-editable copy for Edu Wallet.
 *
 * Editable branding/contact/payment values (website name, tagline, emails,
 * WhatsApp, social links, UPI, delivery estimate, website URL) live ONLY in the
 * `site_settings` database table and are managed in Admin → Settings.
 * Read them with `useSiteSettings()` from `@/lib/settings`.
 * `fallbackBrand` is used solely if the settings cannot be loaded at all.
 */
export const siteConfig = {
  fallbackBrand: { brandName: "Edu Wallet", tagline: "Study Smart. Score Better." },
  shortDescription:
    "Exam-focused notes, guess papers, solved papers, assignment guidance and study resources for competitive, board and entrance exams.",
  copyrightYear: 2026,
  disclaimer:
    "EduWallet is an independent educational resource platform. It is not affiliated with or endorsed by any examination authority, university, board or institution.",
  assignmentDisclaimer:
    "We provide original educational reference and guidance material. Students are responsible for understanding and submitting their own academic work in accordance with their institution's rules.",
  analyticsMeasurementId: "",
} as const;
