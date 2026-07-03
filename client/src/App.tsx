import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { TicketList } from './pages/TicketList';
import { TicketDetail } from './pages/TicketDetail';
import { NewTicket } from './pages/NewTicket';
import { Login } from './pages/Login';

// Header auth corner: who is signed in, and the way in/out.
function AuthStatus() {
  const { user, signOut } = useAuth();
  if (!user) return <Link to="/login">Agent sign in</Link>;
  return (
    <span className="auth-status">
      <span className="muted">{user.name}</span>
      <button type="button" className="link-btn" onClick={signOut}>Sign out</button>
    </span>
  );
}

// WHY client-side routing: the detail page needs a shareable URL
// (/tickets/:id) and the form/login deserve their own — react-router is the
// smallest standard tool for that.
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <header className="app-header">
          <Link to="/"><h1>Support Tickets</h1></Link>
          <AuthStatus />
        </header>
        <main>
          <Routes>
            <Route path="/" element={<TicketList />} />
            <Route path="/new" element={<NewTicket />} />
            <Route path="/login" element={<Login />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="*" element={<p className="muted">Page not found — <Link to="/">go home</Link></p>} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
