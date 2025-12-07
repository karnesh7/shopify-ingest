export default function LoginPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl">For assignment purposes, login is disabled. Click below.</h1>
      <a
        href="/dashboard"
        className="mt-4 px-4 py-2 bg-black text-white rounded"
      >
        Enter Dashboard
      </a>
    </div>
  );
}