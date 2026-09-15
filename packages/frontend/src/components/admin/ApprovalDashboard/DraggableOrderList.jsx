import G from './tokens'
import { getProgColor, progShort } from './utils'

function DraggableOrderList({ order, dragIndex, overIndex, onDragStart, onDragEnter, onDrop, onDragEnd }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {order.map((prog, i) => {
        const isDragging = dragIndex === i
        const isOver = overIndex === i && dragIndex !== null && dragIndex !== i
        const color = getProgColor(prog)
        return (
          <div key={prog} draggable
            onDragStart={() => onDragStart(i)}
            onDragEnter={() => onDragEnter(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(i)}
            onDragEnd={onDragEnd}
            className="ap-order-item"
            style={{
              border: `1.5px solid ${isOver ? G.meadow : G.border}`,
              boxShadow: isDragging ? '0 6px 16px rgba(0,0,0,0.16)' : '0 1px 3px rgba(0,0,0,0.04)',
              opacity: isDragging ? 0.55 : 1,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B8CCC0" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: `${color}18`, border: `1.5px solid ${color}40`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0, fontFamily: "'IBM Plex Mono',monospace" }}>{progShort(prog)}</div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: G.ink }}>{prog}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: G.muted2, fontFamily: "'IBM Plex Mono',monospace" }}>#{i + 1}</div>
          </div>
        )
      })}
    </div>
  )
}

export default DraggableOrderList
