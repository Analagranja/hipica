import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/ui/AppShell.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import Design from './pages/Design.tsx'
import Inicio from './pages/Inicio.tsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/design" element={<Design />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </AuthProvider>
  )
}
