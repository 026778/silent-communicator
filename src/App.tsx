import React, { useState, useEffect, useRef } from 'react';
import { Settings, Check, Plus, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type TileData = {
  id: string;
  shortText: string;
  fullText: string;
  color: string;
  image?: string;
};

const DEFAULT_TILES: TileData[] = [
  { id: '1', shortText: '好的', fullText: '好的 / 是的', color: 'bg-green-500' },
  { id: '2', shortText: '不行', fullText: '不行 / 不是', color: 'bg-red-500' },
  { id: '3', shortText: '谢谢', fullText: '非常感谢', color: 'bg-blue-500' },
  { id: '4', shortText: '稍等', fullText: '请稍等一下', color: 'bg-yellow-500' },
  { id: '5', shortText: '帮忙', fullText: '我需要帮忙', color: 'bg-orange-500' },
  { id: '6', shortText: '听不清', fullText: '环境太吵，我听不清', color: 'bg-purple-500' },
  { id: '7', shortText: '不便说话', fullText: '我现在不方便说话', color: 'bg-pink-500' },
  { id: '8', shortText: '洗手间', fullText: '请问洗手间在哪里？', color: 'bg-teal-500' },
  { id: '9', shortText: '喝水', fullText: '我想喝点水', color: 'bg-cyan-600' },
];

const COLORS = [
  'bg-white/10 backdrop-blur-md',
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 
  'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 
  'bg-cyan-600', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 
  'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 
  'bg-rose-500', 'bg-slate-600'
];

export default function App() {
  const [tiles, setTiles] = useState<TileData[]>(() => {
    const saved = localStorage.getItem('silent-communicator-tiles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_TILES;
  });

  const [activeTile, setActiveTile] = useState<TileData | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTile, setEditingTile] = useState<TileData | null | 'new'>(null);

  // Long press for settings
  const [isPressing, setIsPressing] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  // Swipe detection
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem('silent-communicator-tiles', JSON.stringify(tiles));
  }, [tiles]);

  const handlePressStart = () => {
    setIsPressing(true);
    pressTimer.current = setTimeout(() => {
      setIsEditMode(prev => !prev);
      setIsPressing(false);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 1000);
  };

  const handlePressEnd = () => {
    setIsPressing(false);
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    // Only start tracking if near right edge (to open) or anywhere (to close)
    if (!isEditMode && x < window.innerWidth - 60) return;
    setTouchStartX(x);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const distance = touchStartX - touchEndX;
    
    if (!isEditMode && distance > 50) {
      setIsEditMode(true);
    } else if (isEditMode && distance < -50) {
      setIsEditMode(false);
    }
    setTouchStartX(null);
  };

  const handleTileClick = (tile: TileData) => {
    if (isEditMode) {
      setEditingTile(tile);
    } else {
      setActiveTile(tile);
    }
  };

  const saveTile = (tileData: TileData) => {
    if (editingTile === 'new') {
      setTiles([...tiles, tileData]);
    } else {
      setTiles(tiles.map(t => t.id === tileData.id ? tileData : t));
    }
    setEditingTile(null);
  };

  const deleteTile = (id: string) => {
    setTiles(tiles.filter(t => t.id !== id));
    setEditingTile(null);
  };

  const getGridClasses = (count: number) => {
    if (count === 1) return 'grid-cols-1 grid-rows-1';
    if (count === 2) return 'grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2';
    return 'grid-cols-3 grid-rows-3';
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTiles((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const displayCount = isEditMode && tiles.length < 9 ? tiles.length + 1 : tiles.length;

  return (
    <div 
      className="fixed inset-0 bg-gray-950 overflow-hidden select-none touch-manipulation flex"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Content Area */}
      <div className="flex-1 h-full p-2 md:p-4 relative">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className={`w-full h-full grid gap-2 md:gap-4 transition-all duration-500 ease-in-out ${getGridClasses(displayCount)}`}>
            <SortableContext items={tiles.map(t => t.id)} strategy={rectSortingStrategy}>
              <AnimatePresence mode="popLayout">
                {tiles.map((tile) => (
                  <SortableTile 
                    key={tile.id} 
                    tile={tile} 
                    isEditMode={isEditMode} 
                    onClick={() => handleTileClick(tile)}
                    onEdit={() => handleTileClick(tile)}
                  />
                ))}
              </AnimatePresence>
            </SortableContext>
            
            <AnimatePresence>
              {isEditMode && tiles.length < 9 && (
                <motion.button
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-800 border-4 border-dashed border-gray-600 rounded-3xl flex items-center justify-center active:scale-95 transition-transform"
                  onClick={() => setEditingTile('new')}
                >
                  <Plus className="text-gray-500" size={64} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </DndContext>
      </div>

      {/* Right Sidebar */}
      <div className="w-16 h-full bg-gray-900/80 border-l border-gray-800 flex flex-col items-center justify-center shrink-0 z-40">
        <div className="relative">
          {!isEditMode && (
            <div className="absolute -left-12 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none font-mono whitespace-nowrap -rotate-90 origin-right">
              长按或左滑
            </div>
          )}
          <button
            className={`p-3 rounded-full transition-all ${
              isEditMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:bg-gray-800'
            } ${isPressing ? 'scale-90 bg-gray-800' : 'scale-100'}`}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            {isEditMode ? <Check size={24} /> : <Settings size={24} />}
            
            {/* Progress Ring for long press */}
            {!isEditMode && isPressing && (
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                <circle
                  cx="50%"
                  cy="50%"
                  r="48%"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="2"
                  strokeDasharray="100"
                  strokeDashoffset="100"
                  className="animate-[dash_1s_linear_forwards]"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Full Screen Display */}
      <AnimatePresence>
        {activeTile && (
          <FullScreenDisplay 
            tile={activeTile} 
            onClose={() => setActiveTile(null)} 
          />
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingTile && (
          <EditModal
            tile={editingTile === 'new' ? null : editingTile}
            onSave={saveTile}
            onClose={() => setEditingTile(null)}
            onDelete={editingTile === 'new' ? undefined : () => deleteTile(editingTile.id)}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

// --- Subcomponents ---

function SortableTile({ tile, isEditMode, onClick, onEdit }: { tile: TileData, isEditMode: boolean, onClick: () => void, onEdit: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    zIndex: isDragging ? 50 : 1,
  };

  // Improved jiggle animation with random delay to make them look independent
  const randomDelay = useRef(Math.random() * 0.5).current;
  
  const jiggleVariants = {
    idle: { rotate: 0, scale: 1 },
    jiggle: {
      rotate: [-1.5, 1.5, -1.5, 1.5, 0],
      transition: {
        duration: 0.4,
        repeat: Infinity,
        repeatType: "mirror" as const,
        ease: "easeInOut",
        repeatDelay: 0.1 + randomDelay
      }
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout={!isDragging}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
      className={`relative w-full h-full rounded-3xl shadow-xl overflow-hidden ${isDragging ? 'opacity-80 scale-105 shadow-2xl' : ''}`}
    >
      <motion.button
        variants={jiggleVariants}
        animate={isEditMode && !isDragging ? "jiggle" : "idle"}
        className={`w-full h-full ${tile.color} flex flex-col items-center justify-center active:scale-95 transition-transform relative`}
        onClick={isEditMode ? onEdit : onClick}
        {...attributes}
        {...listeners}
      >
        {tile.image && (
          <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none">
            <img src={tile.image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <span className="text-white text-4xl md:text-5xl lg:text-6xl font-bold px-4 text-center break-words leading-tight drop-shadow-md z-10">
          {tile.shortText}
        </span>
        
        {isEditMode && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[1px] z-20">
            <div className="bg-white/30 p-3 rounded-full shadow-lg">
              <Settings className="text-white" size={32} />
            </div>
          </div>
        )}
      </motion.button>
    </motion.div>
  );
}

function FullScreenDisplay({ tile, onClose }: { tile: TileData, onClose: () => void }) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isUpSwipe = distance > minSwipeDistance;
    if (isUpSwipe) {
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -100, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-8 ${tile.color} text-white`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="absolute top-12 text-white/60 flex flex-col items-center animate-pulse z-20">
         <span className="text-sm md:text-base tracking-widest mb-3 font-medium">上滑关闭</span>
         <div className="w-1.5 h-12 bg-white/60 rounded-full" />
      </div>
      
      {tile.image && (
        <div className="absolute inset-0 flex items-center justify-center p-4 z-0 pointer-events-none">
          <img 
            src={tile.image} 
            alt="" 
            className="w-full h-full object-contain" 
          />
        </div>
      )}
      
      {tile.fullText && (
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-center leading-tight break-words w-full max-w-5xl drop-shadow-2xl z-10">
          {tile.fullText}
        </h1>
      )}
    </motion.div>
  );
}

function EditModal({ 
  tile, 
  onSave, 
  onClose, 
  onDelete 
}: { 
  tile: TileData | null, 
  onSave: (t: TileData) => void, 
  onClose: () => void,
  onDelete?: () => void
}) {
  const [shortText, setShortText] = useState(tile?.shortText || '');
  const [fullText, setFullText] = useState(tile?.fullText || '');
  const [color, setColor] = useState(tile?.color || COLORS[0]);
  const [image, setImage] = useState<string | undefined>(tile?.image);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSave({
      id: tile?.id || Date.now().toString(),
      shortText: shortText.trim(),
      fullText: fullText.trim(),
      color,
      image
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-gray-900 border border-gray-800 rounded-[2rem] p-6 w-full max-w-md text-white shadow-2xl max-h-[90vh] overflow-y-auto touch-pan-y"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`
          .bg-gray-900::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <h2 className="text-2xl font-bold mb-6">{tile ? '编辑磁贴' : '新建磁贴'}</h2>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">磁贴短文本 (最多8字)</label>
            <input 
              type="text" 
              value={shortText} 
              onChange={e => setShortText(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              maxLength={8}
              placeholder="例如：好的"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">全屏展示文本 (可选)</label>
            <textarea 
              value={fullText} 
              onChange={e => setFullText(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none transition-all"
              placeholder="例如：好的，我明白了。"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">全屏展示图片 (可选)</label>
            {image ? (
              <div className="relative w-full h-32 bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                <img src={image} alt="Preview" className="w-full h-full object-contain" />
                <button 
                  onClick={() => setImage(undefined)}
                  className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-16 bg-gray-800 border border-dashed border-gray-600 hover:border-gray-500 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-300 transition-colors"
              >
                <ImageIcon size={24} className="mr-2" />
                <span>添加图片</span>
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3">颜色</label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-12 h-12 rounded-full ${c} ${color === c ? 'ring-4 ring-white scale-110 shadow-lg' : 'opacity-50 hover:opacity-100'} transition-all`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
          {onDelete ? (
            <button onClick={onDelete} className="p-4 text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors">
              <Trash2 size={24} />
            </button>
          ) : <div />}
          
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-4 rounded-2xl font-bold bg-gray-800 hover:bg-gray-700 transition-colors">
              取消
            </button>
            <button 
              onClick={handleSave} 
              className="px-8 py-4 rounded-2xl font-bold bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
