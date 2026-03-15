import { useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordInput } from "@blogging-app/common";
import { APP_NAME, BACKEND_URL } from "../config";

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";
  const hasValidLinkParams = useMemo(() => Boolean(email && token), [email, token]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const parsed = resetPasswordInput.safeParse({
      email,
      token,
      password,
    });
    if (!parsed.success) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/v1/user/reset-password`, parsed.data);
      setMessage(response.data?.msg || "Password reset successful.");
      setTimeout(() => {
        navigate("/signin", { replace: true });
      }, 1200);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        setError(e.response?.data?.msg || "Failed to reset password.");
      } else {
        setError("Failed to reset password.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!hasValidLinkParams) {
    return (
      <div className="min-h-screen flex justify-center flex-col px-4 sm:px-6">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <div className="text-3xl font-extrabold">Invalid reset link</div>
            <p className="text-slate-600 mt-3">This password reset link is incomplete.</p>
            <div className="text-sm text-slate-600 mt-4">
              <Link className="underline" to="/forgot-password">
                Request a new reset link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex justify-center flex-col px-4 sm:px-6">
      <div className="flex justify-center">
        <div className="w-full max-w-md">
          <div className="text-4xl font-extrabold pb-2">Welcome to {APP_NAME}!</div>
          <div className="text-3xl font-extrabold">Choose a new password</div>

          <label className="block mt-4 mb-2 text-sm font-semibold text-gray-900">New password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="mb-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5"
            placeholder="At least 6 characters"
          />

          <label className="block mt-3 mb-2 text-sm font-semibold text-gray-900">Confirm password</label>
          <input
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
            className="mb-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5"
            placeholder="Repeat your password"
          />

          <button
            onClick={() => void submit()}
            type="button"
            disabled={loading}
            className="mt-4 w-full text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Reset password"}
          </button>

          {message ? <p className="text-sm text-green-700 mt-3">{message}</p> : null}
          {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}

          <div className="text-sm text-slate-600 mt-4">
            <Link className="underline" to="/signin">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
