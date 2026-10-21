import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/ui/AppShell.tsx'
import Design from './pages/Design.tsx'
import Inicio from './pages/Inicio.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/design" element={<Design />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}
