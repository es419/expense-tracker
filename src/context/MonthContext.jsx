import { createContext, useContext } from 'react'

export const MonthContext = createContext(null)

export function useSelectedMonth() {
  const context = useContext(MonthContext)
  if (!context) throw new Error('MonthContext is missing')
  return context
}
