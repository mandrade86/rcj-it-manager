import { Badge } from '@/components/ui/badge'
import { tareaTagClass } from '@/lib/tareaTags'
import { cn } from '@/lib/utils'

type Props = {
  tags?: string[] | null
  className?: string
  size?: 'xs' | 'sm'
}

export function TareaTagsList({ tags, className, size = 'xs' }: Props) {
  const list = tags?.filter(Boolean) ?? []
  if (list.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {list.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={cn(
            'font-normal',
            size === 'xs' ? 'text-[10px]' : 'text-xs',
            tareaTagClass(tag),
          )}
        >
          {tag}
        </Badge>
      ))}
    </div>
  )
}
