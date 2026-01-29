import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { RoleLens, WorkflowStage } from '../types/planning';

// ============================================================================
// UI STORE TYPES
// ============================================================================

interface UIStore {
  // Layout State
  leftRailCollapsed: boolean;
  rightPanelCollapsed: boolean;
  leftRailWidth: number;
  rightPanelWidth: number;
  
  // Navigation
  currentStage: WorkflowStage;
  roleLens: RoleLens;
  
  // Canvas State
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  
  // Modal/Dialog State
  activeModal: string | null;
  modalData: any;
  
  // Selection State
  selectedAudienceIds: string[];
  selectedMatrixCellIds: string[];
  
  // AI Panel State
  aiPanelExpanded: boolean;
  aiIsTyping: boolean;
  
  // Demo Mode
  isDemoMode: boolean;
  
  // Layout Actions
  toggleLeftRail: () => void;
  toggleRightPanel: () => void;
  setLeftRailWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  
  // Navigation Actions
  setCurrentStage: (stage: WorkflowStage) => void;
  setRoleLens: (lens: RoleLens) => void;
  goToNextStage: () => void;
  goToPreviousStage: () => void;
  
  // Canvas Actions
  setCanvasZoom: (zoom: number) => void;
  setCanvasPan: (pan: { x: number; y: number }) => void;
  resetCanvasView: () => void;
  
  // Modal Actions
  openModal: (modalId: string, data?: any) => void;
  closeModal: () => void;
  
  // Selection Actions
  selectAudience: (id: string, multi?: boolean) => void;
  deselectAudience: (id: string) => void;
  clearAudienceSelection: () => void;
  selectMatrixCell: (id: string, multi?: boolean) => void;
  deselectMatrixCell: (id: string) => void;
  clearMatrixSelection: () => void;
  
  // AI Panel Actions
  toggleAIPanel: () => void;
  setAITyping: (isTyping: boolean) => void;
  
  // Demo Mode Actions
  toggleDemoMode: () => void;
}

// ============================================================================
// WORKFLOW STAGE ORDER
// ============================================================================

const STAGE_ORDER: WorkflowStage[] = [
  'brief',
  'audiences',
  'content_matrix',
  'production',
  'media',
];

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useUIStore = create<UIStore>()(
  devtools(
    (set, get) => ({
      // Initial State
      leftRailCollapsed: false,
      rightPanelCollapsed: false,
      leftRailWidth: 240,
      rightPanelWidth: 360,
      currentStage: 'brief',
      roleLens: 'all',
      canvasZoom: 1,
      canvasPan: { x: 0, y: 0 },
      activeModal: null,
      modalData: null,
      selectedAudienceIds: [],
      selectedMatrixCellIds: [],
      aiPanelExpanded: true,
      aiIsTyping: false,
      isDemoMode: false,

      // Layout Actions
      toggleLeftRail: () => set((state) => ({
        leftRailCollapsed: !state.leftRailCollapsed,
      })),

      toggleRightPanel: () => set((state) => ({
        rightPanelCollapsed: !state.rightPanelCollapsed,
      })),

      setLeftRailWidth: (width) => set({ leftRailWidth: width }),
      setRightPanelWidth: (width) => set({ rightPanelWidth: width }),

      // Navigation Actions
      setCurrentStage: (stage) => set({ currentStage: stage }),
      
      setRoleLens: (lens) => set({ roleLens: lens }),

      goToNextStage: () => set((state) => {
        const currentIndex = STAGE_ORDER.indexOf(state.currentStage);
        const nextIndex = Math.min(currentIndex + 1, STAGE_ORDER.length - 1);
        return { currentStage: STAGE_ORDER[nextIndex] };
      }),

      goToPreviousStage: () => set((state) => {
        const currentIndex = STAGE_ORDER.indexOf(state.currentStage);
        const prevIndex = Math.max(currentIndex - 1, 0);
        return { currentStage: STAGE_ORDER[prevIndex] };
      }),

      // Canvas Actions
      setCanvasZoom: (zoom) => set({
        canvasZoom: Math.min(Math.max(zoom, 0.25), 2),
      }),

      setCanvasPan: (pan) => set({ canvasPan: pan }),

      resetCanvasView: () => set({
        canvasZoom: 1,
        canvasPan: { x: 0, y: 0 },
      }),

      // Modal Actions
      openModal: (modalId, data) => set({
        activeModal: modalId,
        modalData: data,
      }),

      closeModal: () => set({
        activeModal: null,
        modalData: null,
      }),

      // Selection Actions
      selectAudience: (id, multi = false) => set((state) => {
        if (multi) {
          return {
            selectedAudienceIds: state.selectedAudienceIds.includes(id)
              ? state.selectedAudienceIds.filter((i) => i !== id)
              : [...state.selectedAudienceIds, id],
          };
        }
        return { selectedAudienceIds: [id] };
      }),

      deselectAudience: (id) => set((state) => ({
        selectedAudienceIds: state.selectedAudienceIds.filter((i) => i !== id),
      })),

      clearAudienceSelection: () => set({ selectedAudienceIds: [] }),

      selectMatrixCell: (id, multi = false) => set((state) => {
        if (multi) {
          return {
            selectedMatrixCellIds: state.selectedMatrixCellIds.includes(id)
              ? state.selectedMatrixCellIds.filter((i) => i !== id)
              : [...state.selectedMatrixCellIds, id],
          };
        }
        return { selectedMatrixCellIds: [id] };
      }),

      deselectMatrixCell: (id) => set((state) => ({
        selectedMatrixCellIds: state.selectedMatrixCellIds.filter((i) => i !== id),
      })),

      clearMatrixSelection: () => set({ selectedMatrixCellIds: [] }),

      // AI Panel Actions
      toggleAIPanel: () => set((state) => ({
        aiPanelExpanded: !state.aiPanelExpanded,
      })),

      setAITyping: (isTyping) => set({ aiIsTyping: isTyping }),

      // Demo Mode Actions
      toggleDemoMode: () => set((state) => ({
        isDemoMode: !state.isDemoMode,
      })),
    }),
    { name: 'UIStore' }
  )
);
