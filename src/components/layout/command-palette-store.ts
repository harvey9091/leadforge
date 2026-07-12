"use client";

/**
 * Command palette store — tiny zustand store that owns the open/closed
 * state of the command palette. Decoupling it from React state lets any
 * component (topbar, sidebar, keyboard handler, page-level CTA) open
 * the palette without prop drilling.
 */

import { create } from "zustand";

interface CommandPaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
