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
import { markNotificationPermissionPromptAsHandled, promptForNotificationPermissionOnFirstOpenAfterUpdate, shouldPromptForNotificationPermission } from './lib/push'

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
  const [showPushPermissionPrompt, setShowPushPermissionPrompt] = useState(false);
  const [isPromptingPushPermission, setIsPromptingPushPermission] = useState(false);

  const closePushPermissionPrompt = () => {
    markNotificationPermissionPromptAsHandled();
    setShowPushPermissionPrompt(false);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = await refreshAccessToken();
      const authHeader = getAuthHeader();
      if (token || authHeader) {
        try {
          await promptForNotificationPermissionOnFirstOpenAfterUpdate(authHeader);
        } catch {
          // Ignore push setup errors on startup. Notifications can be configured from Account.
        } finally {
          if (shouldPromptForNotificationPermission()) {
            setShowPushPermissionPrompt(true);
          }
        }
      }
    };

    void bootstrap();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshAccessToken();
      }
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    return () => window.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!shouldPromptForNotificationPermission()) {
      return;
    }

    const onFirstInteraction = () => {
      const authHeader = getAuthHeader();
      if (!authHeader) {
        closePushPermissionPrompt();
        return;
      }

      setShowPushPermissionPrompt(true);
      window.removeEventListener("pointerdown", onFirstInteraction, true);
    };

    window.addEventListener("pointerdown", onFirstInteraction, true);
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction, true);
    };
  }, []);

  const handlePushPromptAction = async () => {
    if (isPromptingPushPermission) {
      return;
    }
    setIsPromptingPushPermission(true);
    try {
      await promptForNotificationPermissionOnFirstOpenAfterUpdate(getAuthHeader());
      if (shouldPromptForNotificationPermission()) {
        setShowPushPermissionPrompt(true);
      } else {
        setShowPushPermissionPrompt(false);
      }
    } catch {
      // Ignore startup push errors.
      setShowPushPermissionPrompt(false);
    } finally {
      setIsPromptingPushPermission(false);
    }
  };

  const pushPermissionPrompt = showPushPermissionPrompt ? (
    <div className="fixed inset-x-0 top-3 z-50 mx-auto flex w-[min(560px,calc(100%-1rem))] justify-center px-2">
      <div className="w-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <div className="text-sm text-slate-800">
          Enable notifications to get a ping when someone posts a new blog.
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePushPromptAction}
            disabled={isPromptingPushPermission}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {isPromptingPushPermission ? "Asking..." : "Enable"}
          </button>
          <button
            type="button"
            onClick={closePushPermissionPrompt}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  ) : null;

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
      </BrowserRouter>
      {pushPermissionPrompt}
    </>
  )
}

export default App
