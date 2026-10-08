import { create } from 'zustand'
import type { WorkItem } from './mock-data'

export type LocalTaskNavigationTarget = Pick<
  WorkItem,
  'id' | 'project' | 'projectPath' | 'intakeState' | 'archivedAt'
>

export const useLocalTaskNavigation = create<{
  target: LocalTaskNavigationTarget | null
  open: (target: LocalTaskNavigationTarget) => void
  clear: () => void
}>((set) => ({
  target: null,
  open: (target) => set({ target: { ...target } }),
  clear: () => set({ target: null })
}))
