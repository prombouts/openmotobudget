import { DEFAULT_MOTORCYCLE_ID } from './record'

export type Motorcycle = {
  id: string
  name: string
}

export const defaultMotorcycle: Motorcycle = {
  id: DEFAULT_MOTORCYCLE_ID,
  name: 'My motorcycle',
}

export function validateMotorcycle(motorcycle: Motorcycle): Motorcycle {
  const id = motorcycle.id.trim()
  const name = motorcycle.name.trim()
  if (!id) throw new Error('A motorcycle id is required.')
  if (!name) throw new Error('A motorcycle name is required.')
  return { id, name }
}
