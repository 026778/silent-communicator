import React, { useState, useEffect, useRef } from 'react';
import { Settings, Check, Plus, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragCancelEvent,
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
type ConfigId = 1 | 2;
type TileConfigs = Record<ConfigId, TileData[]>;

const TEXTS = {
  defaultTiles: [
    { id: '1', shortText: '好的', fullText: '好的 / 是的', color: 'bg-green-500' },
    { id: '2', shortText: '不行', fullText: '不行 / 不是', color: 'bg-red-500' },
    { id: '3', shortText: '多谢', fullText: '非常感谢', color: 'bg-blue-500' },
    { id: '4', shortText: '稍等', fullText: '请稍等一下', color: 'bg-yellow-500' },
    { id: '5', shortText: '帮忙', fullText: '我需要帮忙', color: 'bg-orange-500' },
    { id: '6', shortText: '听不清', fullText: '环境太吵，我听不清', color: 'bg-purple-500' },
    { id: '7', shortText: '不便说话', fullText: '我现在不方便说话', color: 'bg-pink-500' },
    { id: '8', shortText: '洗手间', fullText: '请问洗手间在哪里？', color: 'bg-teal-500' },
    { id: '9', shortText: '喝水', fullText: '我想喝点水', color: 'bg-cyan-600' },
  ],
  guide: {
    title: '进入编辑模式',
    lineOpen: '长按右侧设置按钮，或从屏幕右侧边缘向左滑动。',
    lineClose: '退出编辑模式可直接点右侧按钮，或向左滑动。',
    lineReorder: '长按任意磁贴可拖动调整顺序。',
    lineConfig: '长按侧边栏 1 或 2 可切换配置',
    dismissHint: '点任意空白处可关闭这个提示。',
    ack: '知道了',
    dontShowAgain: '不再显示',
  },
  fullscreen: {
    swipeUpToClose: '上滑关闭',
  },
  editModal: {
    titleEdit: '编辑磁贴',
    titleNew: '新建磁贴',
    shortTextLabel: '磁贴短文本 (最多8字)',
    shortTextPlaceholder: '例如：好的',
    fullTextLabel: '全屏展示文本 (可选)',
    fullTextPlaceholder: '例如：好的，我明白了。',
    imageLabel: '全屏展示图片 (可选)',
    addImage: '添加图片',
    imagePreviewAlt: 'Preview',
    colorLabel: '颜色',
    cancel: '取消',
    save: '保存',
  },
  sidebar: {
    config1: '1',
    config2: '2',
  },
} as const;

const DEFAULT_TILES: TileData[] = TEXTS.defaultTiles.map((tile) => ({ ...tile }));

const COLORS = [
  'bg-white/10 backdrop-blur-md',
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-600',
  'bg-blue-500', 'bg-indigo-500', 'bg-purple-500'
];
const LONG_PRESS_DURATION_MS = 500;
const TILE_DRAG_LONG_PRESS_MS = 320;
const TILE_CONFIGS_KEY = 'silent-communicator-tile-configs';
const LEGACY_TILES_KEY = 'silent-communicator-tiles';
const ACTIVE_CONFIG_KEY = 'silent-communicator-active-config';

export default function App() {
  const [activeConfig, setActiveConfig] = useState<ConfigId>(() => {
    const saved = localStorage.getItem(ACTIVE_CONFIG_KEY);
    return saved === '2' ? 2 : 1;
  });
  const [tileConfigs, setTileConfigs] = useState<TileConfigs>(() => {
    const savedConfigs = localStorage.getItem(TILE_CONFIGS_KEY);
    if (savedConfigs) {
      try {
        const parsed = JSON.parse(savedConfigs);
        if (Array.isArray(parsed?.[1]) && Array.isArray(parsed?.[2])) {
          return { 1: parsed[1], 2: parsed[2] };
        }
      } catch (e) {}
    }

    const legacy = localStorage.getItem(LEGACY_TILES_KEY);
    if (legacy) {
      try {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy)) {
          return { 1: parsedLegacy, 2: DEFAULT_TILES };
        }
      } catch (e) {}
    }
    return { 1: DEFAULT_TILES, 2: DEFAULT_TILES };
  });
  const tiles = tileConfigs[activeConfig];

  const [activeTile, setActiveTile] = useState<TileData | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTile, setEditingTile] = useState<TileData | null | 'new'>(null);
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem('silent-communicator-hide-guide') !== 'true';
  });

  // Long press for settings
  const [pressTarget, setPressTarget] = useState<'settings' | 'config-1' | 'config-2' | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const ignoreNextSidebarClick = useRef(false);
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null);
  const suppressTileClickUntil = useRef(0);
  const dragStartTilesRef = useRef<TileData[] | null>(null);

  // Swipe detection
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(TILE_CONFIGS_KEY, JSON.stringify(tileConfigs));
  }, [tileConfigs]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_CONFIG_KEY, String(activeConfig));
  }, [activeConfig]);

  const updateActiveConfigTiles = (updater: (current: TileData[]) => TileData[]) => {
    const configId = activeConfig;
    setTileConfigs((prev) => ({
      ...prev,
      [configId]: updater(prev[configId]),
    }));
  };

  const handlePressStart = () => {
    if (isEditMode) return;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    setPressTarget('settings');
    ignoreNextSidebarClick.current = false;
    pressTimer.current = setTimeout(() => {
      setIsEditMode(true);
      setPressTarget(null);
      // Consume exactly one click that may be generated when releasing after long press.
      ignoreNextSidebarClick.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DURATION_MS);
  };

  const handlePressEnd = () => {
    setPressTarget(null);
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleConfigPressStart = (configId: ConfigId) => {
    if (isEditMode || configId === activeConfig) return;
    setPressTarget(configId === 1 ? 'config-1' : 'config-2');
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      setActiveConfig(configId);
      setPressTarget(null);
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DURATION_MS);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (draggingTileId) return;
    const target = e.target as EventTarget | null;
    const targetEl = target instanceof HTMLElement ? target : null;
    if (targetEl?.closest('[data-tile-button="true"]')) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const isSidebarTouch = !!targetEl?.closest('[data-sidebar="true"]');
    // Accept swipe only from sidebar itself or a very narrow right-edge lane.
    if (!isSidebarTouch && x < window.innerWidth - 24) return;
    setTouchStartX(x);
    setTouchStartY(y);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (draggingTileId) return;
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const distanceX = touchStartX - touchEndX;
    const distanceY = Math.abs(touchStartY - touchEndY);
    const isHorizontalSwipe = Math.abs(distanceX) > distanceY * 1.2;

    if (!isHorizontalSwipe) {
      setTouchStartX(null);
      setTouchStartY(null);
      return;
    }
    
    if (!isEditMode && distanceX > 60) {
      setIsEditMode(true);
    } else if (isEditMode && distanceX > 60) {
      setIsEditMode(false);
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const handleSidebarClick = () => {
    if (ignoreNextSidebarClick.current) {
      ignoreNextSidebarClick.current = false;
      return;
    }
    if (isEditMode) setIsEditMode(false);
  };

  const handleTileOpen = (tile: TileData) => {
    if (Date.now() < suppressTileClickUntil.current) return;
    setActiveTile(tile);
  };

  const handleTileEdit = (tile: TileData) => {
    if (Date.now() < suppressTileClickUntil.current) return;
    setEditingTile(tile);
  };

  const saveTile = (tileData: TileData) => {
    if (editingTile === 'new') {
      updateActiveConfigTiles((current) => [...current, tileData]);
    } else {
      updateActiveConfigTiles((current) => current.map((t) => t.id === tileData.id ? tileData : t));
    }
    setEditingTile(null);
  };

  const deleteTile = (id: string) => {
    updateActiveConfigTiles((current) => current.filter((t) => t.id !== id));
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
        delay: TILE_DRAG_LONG_PRESS_MS,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingTileId(String(event.active.id));
    dragStartTilesRef.current = [...tiles];
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    updateActiveConfigTiles((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingTileId(null);
    suppressTileClickUntil.current = Date.now() + 220;

    if (!event.over && dragStartTilesRef.current) {
      const startTiles = dragStartTilesRef.current;
      updateActiveConfigTiles(() => startTiles);
    }
    dragStartTilesRef.current = null;
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setDraggingTileId(null);
    suppressTileClickUntil.current = Date.now() + 180;
    if (dragStartTilesRef.current) {
      const startTiles = dragStartTilesRef.current;
      updateActiveConfigTiles(() => startTiles);
      dragStartTilesRef.current = null;
    }
  };

  const displayCount = isEditMode && tiles.length < 9 ? tiles.length + 1 : tiles.length;
  const draggingTile = draggingTileId ? tiles.find((t) => t.id === draggingTileId) || null : null;
  const isPressingSettings = pressTarget === 'settings';
  const isPressingConfig1 = pressTarget === 'config-1';
  const isPressingConfig2 = pressTarget === 'config-2';

  const closeGuide = () => setShowGuide(false);

  const closeGuideForever = () => {
    localStorage.setItem('silent-communicator-hide-guide', 'true');
    setShowGuide(false);
  };

  return (
    <div 
      className={`fixed inset-0 bg-gray-950 overflow-hidden select-none flex overscroll-none ${draggingTileId ? 'touch-none' : 'touch-manipulation'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Content Area */}
      <div className="flex-1 h-full p-2 md:p-4 relative">
        <DndContext 
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className={`w-full h-full grid gap-2 md:gap-4 transition-all duration-300 ease-out ${getGridClasses(displayCount)} ${draggingTileId ? 'ring-2 ring-sky-400/80 ring-offset-2 ring-offset-gray-950 rounded-3xl' : ''}`}>
            <SortableContext items={tiles.map(t => t.id)} strategy={rectSortingStrategy}>
              <AnimatePresence mode="popLayout">
                {tiles.map((tile) => (
                  <SortableTile 
                    key={tile.id} 
                    tile={tile} 
                    isEditMode={isEditMode} 
                    onClick={() => handleTileOpen(tile)}
                    onEdit={() => handleTileEdit(tile)}
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
          <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
            {draggingTile ? <DragTilePreview tile={draggingTile} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Right Sidebar */}
      <div data-sidebar="true" className="relative overflow-hidden w-16 h-full bg-gray-900/80 border-l border-gray-800 grid grid-rows-3 place-items-center py-2 gap-2 shrink-0 z-40">
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none bg-gradient-to-b from-sky-400/35 via-blue-500/30 to-indigo-500/35"
          initial={false}
          animate={pressTarget && !isEditMode ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
          transition={{
            duration: pressTarget ? LONG_PRESS_DURATION_MS / 1000 : 0.18,
            ease: pressTarget ? 'linear' : 'easeOut'
          }}
          style={{ transformOrigin: 'bottom' }}
        />

        <div className="relative w-full h-full flex items-center justify-center">
          <button
            className={`relative h-[85%] min-h-10 max-h-[7.75rem] aspect-[9/21] rounded-2xl font-bold text-base transition-all ${
              activeConfig === 1
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            } ${isPressingConfig1 ? 'scale-95' : 'scale-100'} ${isEditMode ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={isEditMode}
            onTouchStart={() => handleConfigPressStart(1)}
            onTouchEnd={handlePressEnd}
            onMouseDown={() => handleConfigPressStart(1)}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            {TEXTS.sidebar.config1}
            {!isEditMode && isPressingConfig1 && (
              <div
                className="absolute left-0 bottom-0 h-1 rounded-b-2xl bg-white/85 pointer-events-none"
                style={{ animation: `grow ${LONG_PRESS_DURATION_MS}ms linear forwards` }}
              />
            )}
          </button>
        </div>

        <div className="relative w-full h-full flex items-center justify-center">
          <button
            className={`relative h-[85%] min-h-10 max-h-[7.75rem] aspect-[9/21] rounded-2xl flex items-center justify-center transition-all ${
              isEditMode ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 bg-gray-800 hover:bg-gray-700'
            } ${isPressingSettings ? 'scale-95' : 'scale-100'}`}
            onClick={handleSidebarClick}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            {isEditMode ? <Check size={24} /> : <Settings size={24} />}
            
            {/* Progress Ring for long press */}
            {!isEditMode && isPressingSettings && (
              <div
                className="absolute left-0 bottom-0 h-1 rounded-b-2xl bg-white/85 pointer-events-none"
                style={{ animation: `grow ${LONG_PRESS_DURATION_MS}ms linear forwards` }}
              />
            )}
          </button>
        </div>

        <div className="relative w-full h-full flex items-center justify-center">
          <button
            className={`relative h-[85%] min-h-10 max-h-[7.75rem] aspect-[9/21] rounded-2xl font-bold text-base transition-all ${
              activeConfig === 2
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            } ${isPressingConfig2 ? 'scale-95' : 'scale-100'} ${isEditMode ? 'opacity-60 cursor-not-allowed' : ''}`}
            disabled={isEditMode}
            onTouchStart={() => handleConfigPressStart(2)}
            onTouchEnd={handlePressEnd}
            onMouseDown={() => handleConfigPressStart(2)}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            {TEXTS.sidebar.config2}
            {!isEditMode && isPressingConfig2 && (
              <div
                className="absolute left-0 bottom-0 h-1 rounded-b-2xl bg-white/85 pointer-events-none"
                style={{ animation: `grow ${LONG_PRESS_DURATION_MS}ms linear forwards` }}
              />
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

      {/* First-time Guide */}
      <AnimatePresence>
        {showGuide && !isEditMode && !activeTile && !editingTile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm p-6 flex items-center justify-center"
            onClick={closeGuide}
          >
            <motion.div
              initial={{ y: 20, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 12, scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full max-w-md rounded-3xl border border-white/20 bg-gray-900/90 text-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold">{TEXTS.guide.title}</h2>
              <p className="text-white/80 mt-3 leading-relaxed">
                {TEXTS.guide.lineOpen}
              </p>
              <p className="text-white/80 mt-2 leading-relaxed">
                {TEXTS.guide.lineClose}
              </p>
              <p className="text-white/80 mt-2 leading-relaxed">
                {TEXTS.guide.lineReorder}
              </p>
              <p className="text-white/80 mt-2 leading-relaxed">
                {TEXTS.guide.lineConfig}
              </p>
              <p className="text-white/60 text-sm mt-2">
                {TEXTS.guide.dismissHint}
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={closeGuide}
                  className="px-5 py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 font-semibold transition-colors"
                >
                  {TEXTS.guide.ack}
                </button>
                <button
                  onClick={closeGuideForever}
                  className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 font-semibold transition-colors"
                >
                  {TEXTS.guide.dontShowAgain}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes grow {
          from {
            width: 0%;
          }
          to {
            width: 100%;
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
  } = useSortable({ id: tile.id, disabled: isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : (transition || 'transform 140ms ease-out'),
    zIndex: isDragging ? 50 : 1,
    willChange: isDragging ? 'transform' as const : 'auto' as const,
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
        ease: "easeInOut" as const,
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
      className={`relative w-full h-full rounded-3xl shadow-xl overflow-hidden ${isDragging ? 'opacity-15 scale-95' : ''}`}
    >
      <motion.button
        variants={jiggleVariants}
        animate={isEditMode && !isDragging ? "jiggle" : "idle"}
        data-tile-button="true"
        className={`w-full h-full ${tile.color} flex flex-col items-center justify-center transition-transform relative touch-none ${isDragging ? '' : 'active:scale-95'}`}
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

function DragTilePreview({ tile }: { tile: TileData }) {
  return (
    <div className={`relative w-[28vw] h-[28vw] min-w-28 min-h-28 max-w-56 max-h-56 rounded-3xl shadow-2xl overflow-hidden ${tile.color} flex items-center justify-center scale-105 border-2 border-white/60`}>
      {tile.image && (
        <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none">
          <img src={tile.image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <span className="text-white text-3xl md:text-4xl font-bold px-4 text-center break-words leading-tight drop-shadow-md z-10">
        {tile.shortText}
      </span>
    </div>
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
         <span className="text-sm md:text-base tracking-widest mb-3 font-medium">{TEXTS.fullscreen.swipeUpToClose}</span>
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
        <h2 className="text-2xl font-bold mb-6">{tile ? TEXTS.editModal.titleEdit : TEXTS.editModal.titleNew}</h2>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">{TEXTS.editModal.shortTextLabel}</label>
            <input 
              type="text" 
              value={shortText} 
              onChange={e => setShortText(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              maxLength={8}
              placeholder={TEXTS.editModal.shortTextPlaceholder}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">{TEXTS.editModal.fullTextLabel}</label>
            <textarea 
              value={fullText} 
              onChange={e => setFullText(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-2xl px-4 py-4 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none transition-all"
              placeholder={TEXTS.editModal.fullTextPlaceholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">{TEXTS.editModal.imageLabel}</label>
            {image ? (
              <div className="relative w-full h-32 bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                <img src={image} alt={TEXTS.editModal.imagePreviewAlt} className="w-full h-full object-contain" />
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
                <span>{TEXTS.editModal.addImage}</span>
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
            <label className="block text-sm font-medium text-gray-400 mb-3">{TEXTS.editModal.colorLabel}</label>
            <div className="grid grid-cols-6 gap-3">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-full aspect-square rounded-full ${c} ${color === c ? 'ring-4 ring-white scale-110 shadow-lg' : 'opacity-50 hover:opacity-100'} transition-all`}
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
              {TEXTS.editModal.cancel}
            </button>
            <button 
              onClick={handleSave} 
              className="px-8 py-4 rounded-2xl font-bold bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              {TEXTS.editModal.save}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
