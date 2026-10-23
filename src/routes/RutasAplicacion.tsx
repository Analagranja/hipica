import { BrowserRouter, Route, Routes } from 'react-router'
import CrearClub from '../pages/CrearClub.tsx'
import Design from '../pages/Design.tsx'
import Inicio from '../pages/Inicio.tsx'
import Invitacion from '../pages/Invitacion.tsx'
import Login from '../pages/Login.tsx'
import Registro from '../pages/Registro.tsx'
import { RutaConSesion, RutaDeLaApp, RutaDesconocida, RutaPublica } from './Rutas.tsx'

export function RutasAplicacion() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <RutaPublica>
              <Login />
            </RutaPublica>
          }
        />
        <Route
          path="/registro"
          element={
            <RutaPublica>
              <Registro />
            </RutaPublica>
          }
        />
        <Route
          path="/crear-club"
          element={
            <RutaConSesion>
              <CrearClub />
            </RutaConSesion>
          }
        />
        <Route path="/invitacion/:token" element={<Invitacion />} />
        <Route element={<RutaDeLaApp />}>
          <Route path="/" element={<Inicio />} />
          <Route path="/design" element={<Design />} />
        </Route>
        <Route path="*" element={<RutaDesconocida />} />
      </Routes>
    </BrowserRouter>
  )
}
