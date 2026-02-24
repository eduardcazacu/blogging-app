// import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthStorage } from "../lib/auth";

// export interface LogoutInputType{
//     login: string,
//     logout: string,
//   }
  
export const Logout = () => {
    // const [isLoggedin, setIsLoggedin] = useState(false);
    const navigate = useNavigate()
    // setIsLoggedin(true)

    const logout = () => {
        clearAuthStorage();
        // setIsLoggedin(false);
        navigate('/')
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
