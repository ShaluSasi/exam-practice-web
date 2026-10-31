import { z } from "zod";

/**
 * How a quiz's certificate of achievement reads and looks. Admins set it per
 * quiz (worker/quizzes.ts); src/lib/certificate.ts draws it.
 */

export const CERTIFICATE_THEMES = ["gold", "blue", "green", "purple"] as const;

export const CertificateFormat = z.object({
  heading: z.string().trim().min(1).max(60),
  presentedTo: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(1).max(80),
  /** What the certificate calls the quiz; empty for the quiz's own title. */
  title: z.string().trim().max(120),
  /** An extra line under the quiz title, e.g. "Organised by …"; empty for none. */
  note: z.string().trim().max(120),
  /** Who signs it; an empty name leaves the signature out. */
  signName: z.string().trim().max(60),
  signTitle: z.string().trim().max(60),
  theme: z.enum(CERTIFICATE_THEMES),
  showScore: z.boolean(),
});
export type CertificateFormat = z.infer<typeof CertificateFormat>;

export const DEFAULT_CERTIFICATE: CertificateFormat = {
  heading: "Certificate of Achievement",
  presentedTo: "This is proudly presented to",
  reason: "for successfully passing",
  title: "",
  note: "",
  signName: "",
  signTitle: "",
  theme: "gold",
  showScore: true,
};

/** A stored format (JSON or null), with the default for anything missing or invalid. */
export function certificateFormat(json: string | null): CertificateFormat {
  if (!json) return DEFAULT_CERTIFICATE;
  try {
    const parsed = CertificateFormat.safeParse({ ...DEFAULT_CERTIFICATE, ...(JSON.parse(json) as object) });
    return parsed.success ? parsed.data : DEFAULT_CERTIFICATE;
  } catch {
    return DEFAULT_CERTIFICATE;
  }
}
