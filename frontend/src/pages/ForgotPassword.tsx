import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { forgotPasswordInput } from "@blogging-app/common";
import { APP_NAME, BACKEND_URL } from "../config";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setMessage(null);
    const parsed = forgotPasswordInput.safeParse({ email });
    if (!parsed.success) {
      setError("Please enter a valid email.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/v1/user/forgot-password`, parsed.data);
      setMessage(response.data?.msg || "If your account exists, a reset email was sent.");
    } catch (e) {
      if (axios.isAxiosError(e)) {
        setError(e.response?.data?.msg || "Failed to submit request.");
      } else {
        setError("Failed to submit request.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex justify-center flex-col px-4 sm:px-6">
      <div className="flex justify-center">
        <div className="w-full max-w-md">
          <div className="text-4xl font-extrabold pb-2">Welcome to {APP_NAME}!</div>
          <div className="text-3xl font-extrabold">Reset your password</div>
          <div className="text-slate-500 mt-3 mb-3">
            Enter your account email and we&apos;ll send you a reset link.
          </div>

          <label className="block mb-2 text-sm font-semibold text-gray-900">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="mb-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5"
            placeholder="you@example.com"
          />

          <button
            onClick={() => void submit()}
            type="button"
            disabled={loading}
            className="mt-4 w-full text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
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

export default ForgotPassword;
