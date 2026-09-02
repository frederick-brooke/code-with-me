import { signOutAction } from "@/app/actions/auth";
import { pillButtonClassName } from "@/app/components/pill-button";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className={pillButtonClassName}>
        Sign out
      </button>
    </form>
  );
}