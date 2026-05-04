export default function HomeLayout({ children }) {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {children}
    </main>
  );
}
