import { useState, type FormEvent } from 'react'
import { Button } from '../components/ui/Button.tsx'
import { FileField } from '../components/ui/FileField.tsx'
import { Select, type SelectGroup } from '../components/ui/Select.tsx'
import { TextArea } from '../components/ui/TextArea.tsx'
import { TextField } from '../components/ui/TextField.tsx'
import {
  type BoxDisponible,
  type DatosCaballo,
  type PersonaActiva,
  type SexoCaballo,
  type TipoCaballo,
} from '../lib/caballos.ts'
import { etiquetaPersona } from './texto-caballo.ts'

type FormularioCaballoProps = {
  idPrefijo: string
  valores: DatosCaballo
  personas: PersonaActiva[]
  boxes: BoxDisponible[]
  propietarioActual: PersonaActiva | null
  ocupado: boolean
  enviar: string
  onChange: (valores: DatosCaballo) => void
  onSubmit: (event: FormEvent<HTMLFormElement>, foto: File | null) => void
  onCancel: () => void
}

function esTipo(valor: string): valor is TipoCaballo {
  return valor === 'escuela' || valor === 'particular'
}

function esSexo(valor: string): valor is '' | SexoCaballo {
  return valor === '' || valor === 'yegua' || valor === 'padrillo' || valor === 'castrado'
}

function gruposBoxes(boxes: BoxDisponible[]): SelectGroup[] {
  const grupos = new Map<string, SelectGroup>()
  for (const box of boxes) {
    const grupo = grupos.get(box.cuadraId) ?? { label: box.cuadraNombre, options: [] }
    grupo.options.push({ value: box.id, label: `Box ${box.numero}` })
    grupos.set(box.cuadraId, grupo)
  }
  return [...grupos.values()]
}

export function FormularioCaballo({
  idPrefijo,
  valores,
  personas,
  boxes,
  propietarioActual,
  ocupado,
  enviar,
  onChange,
  onSubmit,
  onCancel,
}: FormularioCaballoProps) {
  const [foto, setFoto] = useState<File | null>(null)
  const personasVisibles = [...personas]
  if (
    valores.propietarioId &&
    propietarioActual &&
    propietarioActual.id === valores.propietarioId &&
    !personasVisibles.some((persona) => persona.id === valores.propietarioId)
  ) {
    personasVisibles.unshift(propietarioActual)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => onSubmit(event, foto)}
    >
      <TextField
        id={`${idPrefijo}-nombre`}
        label="Nombre"
        value={valores.nombre}
        disabled={ocupado}
        onChange={(nombre) => onChange({ ...valores, nombre })}
      />
      <Select
        id={`${idPrefijo}-tipo`}
        label="Tipo"
        value={valores.tipo}
        disabled={ocupado}
        options={[
          { value: 'particular', label: 'Particular' },
          { value: 'escuela', label: 'Escuela' },
        ]}
        onChange={(valor) => {
          if (!esTipo(valor)) return
          onChange({
            ...valores,
            tipo: valor,
            propietarioId: valor === 'escuela' ? '' : valores.propietarioId,
          })
        }}
      />
      {valores.tipo === 'particular' ? (
        <Select
          id={`${idPrefijo}-propietario`}
          label="Propietario"
          value={valores.propietarioId}
          disabled={ocupado}
          options={[
            { value: '', label: 'Elegí un propietario' },
            ...personasVisibles.map((persona) => ({
              value: persona.id,
              label: etiquetaPersona(persona),
            })),
          ]}
          onChange={(propietarioId) => onChange({ ...valores, propietarioId })}
        />
      ) : null}
      {valores.tipo === 'particular' && personas.length === 0 && !valores.propietarioId ? (
        <p className="font-body text-muted">No hay personas activas para asignar como propietario.</p>
      ) : null}
      <Select
        id={`${idPrefijo}-box`}
        label="Box"
        value={valores.boxId}
        disabled={ocupado}
        options={[{ value: '', label: 'Sin box' }]}
        groups={gruposBoxes(boxes)}
        onChange={(boxId) => onChange({ ...valores, boxId })}
      />
      <TextField
        id={`${idPrefijo}-nacimiento`}
        label="Nacimiento"
        type="date"
        value={valores.nacimiento}
        disabled={ocupado}
        onChange={(nacimiento) => onChange({ ...valores, nacimiento })}
      />
      <TextField
        id={`${idPrefijo}-raza`}
        label="Raza"
        value={valores.raza}
        disabled={ocupado}
        onChange={(raza) => onChange({ ...valores, raza })}
      />
      <TextField
        id={`${idPrefijo}-pelaje`}
        label="Pelaje"
        value={valores.pelaje}
        disabled={ocupado}
        onChange={(pelaje) => onChange({ ...valores, pelaje })}
      />
      <Select
        id={`${idPrefijo}-sexo`}
        label="Sexo"
        value={valores.sexo}
        disabled={ocupado}
        options={[
          { value: '', label: 'Sin especificar' },
          { value: 'yegua', label: 'Yegua' },
          { value: 'padrillo', label: 'Padrillo' },
          { value: 'castrado', label: 'Castrado' },
        ]}
        onChange={(valor) => {
          if (!esSexo(valor)) return
          onChange({ ...valores, sexo: valor })
        }}
      />
      <TextField
        id={`${idPrefijo}-registro`}
        label="Número de registro"
        value={valores.numeroRegistro}
        disabled={ocupado}
        onChange={(numeroRegistro) => onChange({ ...valores, numeroRegistro })}
      />
      <TextArea
        id={`${idPrefijo}-observaciones`}
        label="Observaciones"
        value={valores.observaciones}
        disabled={ocupado}
        onChange={(observaciones) => onChange({ ...valores, observaciones })}
      />
      <FileField
        id={`${idPrefijo}-foto`}
        label="Foto"
        accept="image/jpeg,image/png,image/webp"
        disabled={ocupado}
        onChange={setFoto}
      />
      {foto ? <p className="font-body text-muted">{foto.name}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="w-full sm:w-auto" disabled={ocupado}>
          {enviar}
        </Button>
        <Button
          variant="ghost"
          className="w-full sm:w-auto"
          disabled={ocupado}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
