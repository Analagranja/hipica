import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import Caballo from '../pages/Caballo.tsx'
import Caballos from '../pages/Caballos.tsx'
import Cobranza from '../pages/Cobranza.tsx'
import Conceptos from '../pages/Conceptos.tsx'
import CrearClub from '../pages/CrearClub.tsx'
import Cuadras from '../pages/Cuadras.tsx'
import Design from '../pages/Design.tsx'
import Inicio from '../pages/Inicio.tsx'
import Pago from '../pages/Pago.tsx'
import Pagos from '../pages/Pagos.tsx'
import Pension from '../pages/Pension.tsx'
import Persona from '../pages/Persona.tsx'
import Pensiones from '../pages/Pensiones.tsx'
import Personas from '../pages/Personas.tsx'
import RegistrarPago from '../pages/RegistrarPago.tsx'
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
          <Route path="/cuadras" element={<Cuadras />} />
          <Route path="/caballos" element={<Caballos />} />
          <Route path="/caballos/:id" element={<Caballo />} />
          <Route path="/personas" element={<Personas />} />
          <Route path="/personas/:id" element={<Persona />} />
          <Route path="/cobranza" element={<Cobranza />}>
            <Route index element={<Navigate to="conceptos" replace />} />
            <Route path="conceptos" element={<Conceptos />} />
            <Route path="pensiones" element={<Pensiones />} />
            <Route path="pensiones/:id" element={<Pension />} />
            <Route path="pagos" element={<Pagos />} />
            <Route path="pagos/nuevo" element={<RegistrarPago />} />
            <Route path="pagos/:id" element={<Pago />} />
          </Route>
          <Route path="/design" element={<Design />} />
        </Route>
        <Route path="*" element={<RutaDesconocida />} />
      </Routes>
    </BrowserRouter>
  )
}
