export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/images/login-background.png"
        type="image/png"
      />
      {children}
    </>
  );
}
