/**
 * Central configuration for Edu Wallet.
 * Change brand, contact and payment details here only — never inline in components.
 */
export const siteConfig = {
  brandName: "Edu Wallet",
  tagline: "Study Smart. Score Better.",
  shortDescription:
    "Exam-focused notes, guess papers, assignment guidance and study resources designed for IGNOU students.",
  websiteUrl: "https://eduwallet.example",
  contactEmail: "supporteduwallet@gmail.com",
  secondaryContactEmail: "supporteduwallet@gmail.com",
  upiId: "eduwallet@upi",
  upiPayeeName: "Edu Wallet",
  /** Optional: path/URL to a UPI QR image. Leave empty to show a generated QR. */
  qrCodeUrl: "",
  deliveryEstimate: "Usually within 6–12 hours of payment verification",
  copyrightYear: 2026,
  social: {
    instagram: "",
    telegram: "",
    youtube: "",
  },
  disclaimer:
    "Edu Wallet is an independent educational resource platform and is not affiliated with or endorsed by IGNOU.",
  assignmentDisclaimer:
    "Edu Wallet provides original educational reference and guidance material. Students are responsible for understanding and submitting their own academic work in accordance with their institution's rules.",
} as const;

export const upiPayLink = (amount: number, note: string) =>
  `upi://pay?pa=${encodeURIComponent(siteConfig.upiId)}&pn=${encodeURIComponent(
    siteConfig.upiPayeeName,
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
