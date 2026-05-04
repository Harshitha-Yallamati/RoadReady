import Navbar from './Navbar';

export default function AppLayout({ children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg)', overflow: 'hidden' }}>
      <Navbar />
      <main style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative', overflow: 'auto' }}>{children}</main>
    </div>
  );
}
