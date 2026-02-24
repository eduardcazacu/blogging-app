import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BACKEND_URL } from "../config";

export const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  const payload = useMemo(() => {
    const email = searchParams.get("email") || "";
    const token = searchParams.get("token") || "";
    return { email, token };
  }, [searchParams]);

  useEffect(() => {
    async function verify() {
      if (!payload.email || !payload.token) {
        setStatus("error");
        setMessage("Invalid verification link.");
        return;
      }

      try {
        const response = await axios.post(`${BACKEND_URL}/api/v1/user/verify-email`, payload);
        setStatus("success");
        setMessage(response.data?.msg || "Email verified. You can now sign in.");
      } catch (e) {
        setStatus("error");
        if (axios.isAxiosError(e)) {
          setMessage(e.response?.data?.msg || "Email verification failed.");
          return;
        }
        setMessage("Email verification failed.");
      }
    }

    verify();
  }, [payload]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold">Email Verification</h1>
        <p className="mt-3 text-sm text-slate-700">{message}</p>
        {status !== "loading" ? (
          <Link
            to="/signin"
            className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Go to Sign In
          </Link>
        ) : null}
      </div>
    </div>
  );
};

export default VerifyEmail;
