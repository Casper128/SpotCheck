"use client";

import { create } from "zustand";

export type PinFilter = "open" | "resolved";

export interface GuestSession {
  readonly id: string;
  readonly displayName: string;
}

interface ReviewState {
  readonly commentingEnabled: boolean;
  readonly selectedPinId: string | null;
  readonly filter: PinFilter;
  readonly reviewer: GuestSession | null;
  setCommentingEnabled: (enabled: boolean) => void;
  setSelectedPinId: (pinId: string | null) => void;
  setFilter: (filter: PinFilter) => void;
  setReviewer: (reviewer: GuestSession) => void;
  clearReviewer: () => void;
}

export const useReviewStore = create<ReviewState>((set) => ({
  commentingEnabled: false,
  selectedPinId: null,
  filter: "open",
  reviewer: null,
  setCommentingEnabled: (commentingEnabled) => set({ commentingEnabled }),
  setSelectedPinId: (selectedPinId) => set({ selectedPinId }),
  setFilter: (filter) => set({ filter }),
  setReviewer: (reviewer) => set({ reviewer }),
  clearReviewer: () => set({ reviewer: null }),
}));
