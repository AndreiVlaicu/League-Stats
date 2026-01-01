import { Injectable, effect, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type FavoritePlayer = {
  key: string;
  region: string;
  gameName: string;
  tagLine: string;
  label?: string;
  addedAt: number;
};

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly LS_KEY = 'lol_favorites_v1';

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  favorites = signal<FavoritePlayer[]>(this.read());

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        try {
          localStorage.setItem(this.LS_KEY, JSON.stringify(this.favorites()));
        } catch {}
      });
    }
  }

  private read(): FavoritePlayer[] {
    if (!this.isBrowser) return [];
    try {
      const raw = localStorage.getItem(this.LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private makeKey(region: string, gameName: string, tagLine: string) {
    return `${region.toUpperCase()}:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`;
  }

  isFavorite(region: string, gameName: string, tagLine: string) {
    return this.favorites().some((f) => f.key === this.makeKey(region, gameName, tagLine));
  }

  add(region: string, gameName: string, tagLine: string, label?: string) {
    if (this.isFavorite(region, gameName, tagLine)) return;
    this.favorites.set([
      {
        key: this.makeKey(region, gameName, tagLine),
        region,
        gameName,
        tagLine,
        label,
        addedAt: Date.now(),
      },
      ...this.favorites(),
    ]);
  }

  remove(region: string, gameName: string, tagLine: string) {
    const key = this.makeKey(region, gameName, tagLine);
    this.favorites.set(this.favorites().filter((f) => f.key !== key));
  }

  toggle(region: string, gameName: string, tagLine: string, label?: string) {
    this.isFavorite(region, gameName, tagLine)
      ? this.remove(region, gameName, tagLine)
      : this.add(region, gameName, tagLine, label);
  }

  clear() {
    this.favorites.set([]);
  }
}
