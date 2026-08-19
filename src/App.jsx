import { lazy, Suspense, useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LegalPage from './pages/LegalPage';
import Logo from './components/Logo';
import Preloader from './components/Preloader';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load admin and portal pages for fast loading
const AdminPage = lazy(() => import('./pages/AdminPage'));
const PortalPage = lazy(() => import('./pages/PortalPage'));

/** Detect if current hostname or dev parameter is an operational subdomain */
function getSubdomain() {
  if (typeof window === 'undefined') return null;
  
  const host = window.location.hostname.toLowerCase();
  
  // Production / Staging Subdomains: admin.tanvo.tech, admin.localhost
  if (host.startsWith('admin.')) return 'admin';
  
  // Production / Staging Subdomains: portal.tanvo.tech, client.tanvo.tech, portal.localhost
  if (host.startsWith('portal.') || host.startsWith('client.')) return 'portal';
  
  // Local Development override query parameter (e.g. localhost:5173?app=admin or ?subdomain=admin)
  const params = new URLSearchParams(window.location.search);
  const appParam = params.get('app') || params.get('subdomain');
  if (appParam === 'admin') return 'admin';
  if (appParam === 'portal' || appParam === 'client') return 'portal';
  
  return null;
}

/**
 * Owns scroll position across navigation.
 *
 * Without a hash: reset to the top on route change.
 *
 * With a hash: scroll to the target ourselves. The browser tries this at
 * initial parse, when the document is still an empty <div id="root"> and
 * the section does not exist yet — so it silently gives up and the
 * visitor lands at the top. Anyone opening a shared tanvo.tech/#contact
 * link would never reach the contact section.
 *
 * Header offset is handled by `scroll-padding-top` in index.css, which
 * scrollIntoView respects.
 */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      return undefined;
    }

    const id = decodeURIComponent(hash.slice(1));
    const go = () => {
      const target = document.getElementById(id);
      target?.scrollIntoView({ behavior: 'instant', block: 'start' });
      return Boolean(target);
    };

    // Two frames: one for the route to commit, one for layout.
    let inner;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(go);
    });
    // Late images and webfonts shift layout under us — correct once more.
    const settle = setTimeout(go, 350);

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      clearTimeout(settle);
    };
  }, [pathname, hash]);

  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#030307]" role="status">
      <span className="sr-only">Loading…</span>
      <div className="relative flex items-center justify-center">
        <Logo className="h-10 w-10 animate-pulse" showText={false} />
        <div
          aria-hidden="true"
          className="absolute -inset-2 animate-spin rounded-full border-2 border-white/5 border-t-cyan-400"
        />
      </div>
    </div>
  );
}

/** Smart redirect to subdomain or dev app */
function SmartSubdomainRedirect({ targetSubdomain }) {
  useEffect(() => {
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (isLocal) {
      window.location.replace(`/?app=${targetSubdomain}`);
    } else {
      window.location.replace(`https://${targetSubdomain}.tanvo.tech`);
    }
  }, [targetSubdomain]);

  return <RouteFallback />;
}

export default function App() {
  const subdomain = useMemo(() => getSubdomain(), []);

  return (
    <ErrorBoundary label="the application">
      {/* Sits above the routes; self-dismisses and shows once per session on marketing site */}
      {!subdomain && <Preloader />}
      <ScrollManager />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/privacy" element={<LegalPage variant="privacy" />} />
          <Route path="/terms" element={<LegalPage variant="terms" />} />
          
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="/portal/*" element={<PortalPage />} />
          <Route path="/client/*" element={<PortalPage />} />

          {/* Seamless Auto-Redirect to Homepage (Zero 404 screens) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
