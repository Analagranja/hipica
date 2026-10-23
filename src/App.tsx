import { AuthProvider } from './context/AuthContext.tsx'
import { RutasAplicacion } from './routes/RutasAplicacion.tsx'

export default function App() {
  return (
    <AuthProvider>
      <RutasAplicacion />
    </AuthProvider>
  )
}
