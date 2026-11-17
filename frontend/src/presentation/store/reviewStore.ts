"use client";

import { create } from "zustand";
import type { PinPlacementMode } from "@/presentation/domInspectorProtocol";

export type PinFilter = "open" | "resolved";

export type { GuestSession } from "@/domain/types";

interface ReviewState {
  readonly placementMode: PinPlacementMode;
  readonly selectedPinId: string | null;
  readonly filter: PinFilter;
  setPlacementMode: (mode: PinPlacementMode) => void;
  setSelectedPinId: (pinId: string | null) => void;
  setFilter: (filter: PinFilter) => void;
}

export const useReviewStore = create<ReviewState>((set) => ({
  placementMode: "off",
  selectedPinId: null,
  filter: "open",
  setPlacementMode: (placementMode) => set({ placementMode }),
  setSelectedPinId: (selectedPinId) => set({ selectedPinId }),
  setFilter: (filter) => set({ filter }),
}));
