import { useEffect, useState } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type DashboardTodoItem = {
  id: string
  text: string
  done: boolean
}

function storageKey(userId: string) {
  return `rcj_dashboard_todos_${userId}`
}

function loadTodos(userId: string): DashboardTodoItem[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x) => x && typeof x === 'object')
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.id === 'string' && typeof x.text === 'string')
      .map((x) => ({
        id: x.id as string,
        text: x.text as string,
        done: Boolean(x.done),
      }))
  } catch {
    return []
  }
}

function saveTodos(userId: string, items: DashboardTodoItem[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(items))
  } catch {
    /* noop */
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function reorder(items: DashboardTodoItem[], dragId: string, dropId: string): DashboardTodoItem[] {
  const dragIdx = items.findIndex((i) => i.id === dragId)
  const dropIdx = items.findIndex((i) => i.id === dropId)
  if (dragIdx === -1 || dropIdx === -1 || dragIdx === dropIdx) return items
  const next = [...items]
  const [removed] = next.splice(dragIdx, 1)
  next.splice(dropIdx, 0, removed)
  return next
}

type Props = {
  userId: string
}

export function DashboardPersonalTodos({ userId }: Props) {
  const [items, setItems] = useState<DashboardTodoItem[]>([])
  const [draft, setDraft] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)

  useEffect(() => {
    setItems(loadTodos(userId))
  }, [userId])

  function addItem() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setItems((prev) => {
      const next = [...prev, { id: newId(), text, done: false }]
      saveTodos(userId, next)
      return next
    })
  }

  function toggleDone(id: string) {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i))
      saveTodos(userId, next)
      return next
    })
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id)
      saveTodos(userId, next)
      return next
    })
  }

  function handleDropOn(targetId: string, dragId: string) {
    if (!dragId || dragId === targetId) return
    setItems((prev) => {
      const next = reorder(prev, dragId, targetId)
      saveTodos(userId, next)
      return next
    })
  }

  return (
    <Card className="flex h-full min-h-[280px] flex-col shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Mi lista del día</CardTitle>
        <p className="text-xs text-muted-foreground">
          Recordatorios personales (solo en tu navegador). Arrastra el icono{' '}
          <GripVertical className="inline size-3 align-text-bottom text-muted-foreground" aria-hidden /> para
          reordenar.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nueva nota…"
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addItem()
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="shrink-0 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            onClick={addItem}
            aria-label="Agregar"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <ul className="max-h-[320px] flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {items.length === 0 ? (
            <li className="rounded-md border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              Sin ítems. Escribe arriba y pulsa + o Enter.
            </li>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-2 rounded-md border border-border bg-muted/15 px-2 py-1.5 transition-colors',
                  draggingId === item.id && 'opacity-60 ring-2 ring-[var(--lime)]/40',
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/plain')
                  handleDropOn(item.id, id)
                  setDraggingId(null)
                }}
              >
                <span
                  role="button"
                  tabIndex={0}
                  draggable
                  className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                  title="Arrastrar para reordenar"
                  aria-label="Arrastrar para reordenar"
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggingId(item.id)
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                    }
                  }}
                >
                  <GripVertical className="size-4" />
                </span>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-[var(--lime)]"
                    checked={item.done}
                    onChange={() => toggleDone(item.id)}
                  />
                  <span className={cn('min-w-0 break-words', item.done && 'text-muted-foreground line-through')}>
                    {item.text}
                  </span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Eliminar"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  )
}
