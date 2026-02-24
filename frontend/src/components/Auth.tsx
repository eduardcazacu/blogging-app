import { ChangeEvent, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { APP_NAME, BACKEND_URL } from "../config"
import axios from "axios"
import { SigninInput, SignupInput, signinInput, signupInput } from "@blogging-app/common"
import { getAuthHeader, persistTokenFromResponse } from "../lib/auth"

export const Auth = ({type}: {type: "signup" | "signin"}) => {

  const navigate = useNavigate();
  const [postInputs, setPostInputs] = useState<SignupInput & SigninInput>({
    name: "",
    email: "",
    password: ""
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldownSec <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      setResendCooldownSec((value) => value - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldownSec]);

  async function sendRequest () {
    setErrorMessage(null);
    setResendMessage(null);
    setShowResendVerification(false);
    const parsed = (type === "signup" ? signupInput : signinInput).safeParse(postInputs);
    if (!parsed.success) {
      alert("Please enter a valid email and password.");
      return;
    }

    try{
      const response = await axios.post(
        `${BACKEND_URL}/api/v1/user/${type === "signup" ? "signup" : "signin"}`,
        parsed.data
      );
      if (type === "signup") {
        alert(response.data?.msg || "Signup complete. Check your email to verify your account.");
        navigate("/signin");
        return;
      }

      const jwt = persistTokenFromResponse(response.data);
      if (!jwt) {
        alert("Auth succeeded but token was missing in response.");
        return;
      }
      const me = await axios.get(`${BACKEND_URL}/api/v1/user/me`, {
        headers: {
          Authorization: getAuthHeader(),
        },
      });
      const profile = me.data?.user as { name?: string | null; email?: string; isAdmin?: boolean; themeKey?: string | null };
      const displayName =
        (profile?.name && profile.name.trim()) ||
        profile?.email?.trim() ||
        "User";
      localStorage.setItem("displayName", displayName);
      localStorage.setItem("userEmail", (profile?.email || parsed.data.email).trim().toLowerCase());
      localStorage.setItem("isAdmin", profile?.isAdmin ? "true" : "false");
      if (profile?.themeKey) {
        localStorage.setItem("themeKey", profile.themeKey);
      } else {
        localStorage.removeItem("themeKey");
      }
      navigate("/blogs")
    } catch (e: unknown){
      if (axios.isAxiosError(e)) {
        const msg = e.response?.data?.msg || "Auth request failed";
        setErrorMessage(msg);
        if (type === "signin" && msg.toLowerCase().includes("verify your email")) {
          setShowResendVerification(true);
        }
        return;
      }
      setErrorMessage("Auth request failed");
    }
  }

  async function resendVerificationEmail() {
    if (!postInputs.email || resendCooldownSec > 0 || resendLoading) {
      return;
    }

    setResendLoading(true);
    setResendMessage(null);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/v1/user/resend-verification`, {
        email: postInputs.email,
      });
      setResendMessage(response.data?.msg || "Verification email sent.");
      setResendCooldownSec(60);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const retryAfterSeconds = Number(e.response?.data?.retryAfterSeconds);
        if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
          setResendCooldownSec(Math.ceil(retryAfterSeconds));
        }
        setResendMessage(e.response?.data?.msg || "Failed to resend verification email.");
      } else {
        setResendMessage("Failed to resend verification email.");
      }
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex justify-center flex-col px-4 sm:px-6">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <div className="text-4xl font-extrabold pb-2">
            Welcome to {APP_NAME}! <br />
            </div>
            <div className="text-3xl font-extrabold ">
            Create an account
            </div>
            <div className="text-slate-500 mt-3 mb-3">
                {type === "signin" ? "Dont have an account:?" : "Already have an account?"}
                <Link className="pl-2 underline" to={type=== "signin" ? "/" : "/signin"}>
                  {type === "signin" ? "Sign Up" : "Sign In"}
                </Link>
            </div>

            {type === "signup" ? <LabelledInput label="Name" placeholder="Your name" onChange={(e) =>{
              setPostInputs({
                ...postInputs,
                name: e.target.value
              })
            }}/> : null}

            <LabelledInput label="Email" placeholder="you@example.com" onChange={(e) =>{
              setPostInputs({
                ...postInputs,
                email: e.target.value
              })
            }}/>

            <LabelledInput label="Password" type={"password"} placeholder="123456" onChange={(e) =>{
              setPostInputs({
                ...postInputs,
                password: e.target.value
              })
            }}/>

          <button onClick={sendRequest} type="button" className="mt-6 w-full text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700">{type === "signup" ? "Sign Up" : "Sign In"}</button>
          {errorMessage ? (
            <p className="text-sm text-red-600 mt-2">{errorMessage}</p>
          ) : null}
          {type === "signin" && showResendVerification ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm text-slate-700">
                Didn&apos;t receive the verification email?
              </p>
              <button
                type="button"
                onClick={resendVerificationEmail}
                disabled={resendLoading || resendCooldownSec > 0}
                className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendLoading
                  ? "Sending..."
                  : resendCooldownSec > 0
                    ? `Resend in ${resendCooldownSec}s`
                    : "Resend verification email"}
              </button>
              {resendMessage ? (
                <p className="text-sm text-slate-700 mt-2">{resendMessage}</p>
              ) : null}
            </div>
          ) : null}

          </div>
        </div>
    </div>
    
  )
}

interface LabelledInputType{
  label: string,
  placeholder: string,
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: string
}

function LabelledInput({label, placeholder, onChange, type}: LabelledInputType){
  return <div>

          <label className="block mb-2 text-sm font-semibold text-gray-900 dark:text-white">{label}</label>
          <input onChange={onChange} type={type || "text"} id="first_name" className="mb-2 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" placeholder={placeholder} required />
            
        </div>
}

export default Auth
