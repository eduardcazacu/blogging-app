// import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config";
import { clearAuthStorage } from "../lib/auth";

// export interface LogoutInputType{
//     login: string,
//     logout: string,
//   }
  
export const Logout = () => {
    // const [isLoggedin, setIsLoggedin] = useState(false);
    const navigate = useNavigate()
    // setIsLoggedin(true)

    const logout = async () => {
        try {
            await axios.post(`${BACKEND_URL}/api/v1/user/logout`, {}, { withCredentials: true });
        } catch {
            // Ignore logout API failures and still clear local state.
        } finally {
            clearAuthStorage();
            navigate('/')
        }
    };

    // const login = () =>{
    //     navigate("/signin")
    // }

  return (
    <div>
        <button 
        //    onClick={() => {
        //     `type === "login" : ${login} ? ${logout}`
        //    }}
        onClick={logout}
           type="button"
            className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-full text-xs px-3 py-2 sm:text-sm sm:px-5 sm:py-2.5"
          >
           Logout
          </button>
    </div>
  )
}
