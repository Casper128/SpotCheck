"use client";

import { create } from "zustand";
import type { PinPlacementMode } from "@/presentation/domInspectorProtocol";

export type PinFilter = "open" | "resolved";

export interface GuestSession {
  readonly id: string;
  readonly displayName: string;
}

interface ReviewState {
  readonly placementMode: PinPlacementMode;
  readonly selectedPinId: string | null;
  readonly filter: PinFilter;
  readonly reviewer: GuestSession | null;
  setPlacementMode: (mode: PinPlacementMode) => void;
  setSelectedPinId: (pinId: string | null) => void;
  setFilter: (filter: PinFilter) => void;
  setReviewer: (reviewer: GuestSession) => void;
  clearReviewer: () => void;
}

export const useReviewStore = create<ReviewState>((set) => ({
  placementMode: "off",
  selectedPinId: null,
  filter: "open",
  reviewer: null,
  setPlacementMode: (placementMode) => set({ placementMode }),
  setSelectedPinId: (selectedPinId) => set({ selectedPinId }),
  setFilter: (filter) => set({ filter }),
  setReviewer: (reviewer) => set({ reviewer }),
  clearReviewer: () => set({ reviewer: null }),
}));
