import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Signup } from './pages/Signup'
import { Signin } from './pages/Signin'
import { Blog } from './pages/Blog'
import { Blogs } from './pages/Blogs'
import { Publish } from './pages/Publish'
import { Account } from './pages/Account'
import { Admin } from './pages/Admin'
import { VerifyEmail } from './pages/VerifyEmail'
import { ForgotPassword } from './pages/ForgotPassword'
import { ResetPassword } from './pages/ResetPassword'
import { getAuthHeader, refreshAccessToken } from './lib/auth'
import { enablePushIfPermissionGranted } from './lib/push'
import { NotificationPrompt } from './components/NotificationPrompt'

function RootRedirect() {
  const [targetPath, setTargetPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (getAuthHeader()) {
        if (active) {
          setTargetPath("/blogs");
        }
        return;
      }

      const refreshedToken = await refreshAccessToken();
      if (!active) {
        return;
      }
      setTargetPath(refreshedToken ? "/blogs" : "/signin");
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  if (!targetPath) {
    return <div className="min-h-screen bg-slate-100" />;
  }

  return <Navigate to={targetPath} replace />;
}

function App() {
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      await refreshAccessToken();
      if (cancelled) return;
      const authHeader = getAuthHeader();
      if (!authHeader) return;
      try {
        await enablePushIfPermissionGranted(authHeader);
      } catch {
        // Silent re-sync only; user can re-enable from the banner or Account page.
      }
    };

    void bootstrap();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshAccessToken();
      }
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/blog/:id" element={<Blog />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Routes>
        <NotificationPrompt />
      </BrowserRouter>
    </>
  )
}

export default App
