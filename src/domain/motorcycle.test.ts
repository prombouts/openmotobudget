import { describe, expect, it } from 'vitest'
import {
  defaultMotorcycle,
  validateMotorcycle,
} from './motorcycle'

describe('motorcycles', () => {
  it('provides a named default motorcycle for existing records', () => {
    expect(defaultMotorcycle).toEqual({
      id: 'default-motorcycle',
      name: 'My motorcycle',
    })
  })

  it('trims valid names and rejects blank names', () => {
    expect(validateMotorcycle({ id: 'bike-1', name: '  Road bike  ' })).toEqual({
      id: 'bike-1',
      name: 'Road bike',
    })
    expect(() => validateMotorcycle({ id: 'bike-1', name: '   ' }))
      .toThrow('A motorcycle name is required.')
  })
})
