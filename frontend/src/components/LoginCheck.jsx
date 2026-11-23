import Spinner from "@/components/Spinner";

// Shown while the app asks the server whether someone is logged in.
export default function LoginCheck() {
  return (
    <p role="status" className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground">
      <Spinner label="Checking your login" />
      Checking your login...
    </p>
  );
}
