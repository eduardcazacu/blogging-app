import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Signup } from './pages/Signup'
import { Signin } from './pages/Signin'
import { Blog } from './pages/Blog'
import { Blogs } from './pages/Blogs'
import { Publish } from './pages/Publish'
import { Account } from './pages/Account'
import { Admin } from './pages/Admin'
import { VerifyEmail } from './pages/VerifyEmail'

function App() {

  return (
    <>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Signup />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/blog/:id" element={<Blog />} />
          <Route path="/blogs" element={<Blogs />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
