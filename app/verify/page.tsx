import { VerifyMagicLinkForm } from "@/app/components/verify-magic-link-form";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; code?: string }>;
}) {
  const { email, code } = await searchParams;
  return <VerifyMagicLinkForm email={email} code={code} />;
}