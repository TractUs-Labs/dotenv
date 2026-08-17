import { signIn } from "@/lib/auth/auth";

export default function SignInPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit">Sign in with Google</button>
      </form>
    </main>
  );
}
