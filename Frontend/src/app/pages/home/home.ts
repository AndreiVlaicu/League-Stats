import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RiotApiService } from '../../core/riot-api';
import { forkJoin, of, switchMap, throwError } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, map } from 'rxjs/operators';
import { FavoritesService, FavoritePlayer } from '../../core/services/favorites';

import { RegionUI, REGION_TO_PLATFORM, REGION_TO_ROUTING } from '../../core/regions';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class HomeComponent {
  private riot = inject(RiotApiService);
  private router = inject(Router);

  region: RegionUI = 'EUW';
  gameName = 'Caps';
  tagLine = 'G2';

  data = signal<any>(null);
  error = signal<string | null>(null);
  loading = signal(false);

  playerInput = '';

  presets: Array<{ region: RegionUI; gameName: string; tagLine: string; label: string }> = [
    { region: 'EUW', gameName: 'Caps', tagLine: 'G2', label: 'Caps#G2 (EUW)' },
    { region: 'EUNE', gameName: 'alfa', tagLine: 'UE4', label: 'alfa#UE4 (EUNE)' },
    { region: 'EUNE', gameName: 'Gimishoor', tagLine: '1337', label: 'Gimishoor#1337 (EUNE)' },
  ];

  uniqueGameNames(): string[] {
    return Array.from(new Set(this.presets.map((p) => p.gameName))).sort();
  }
  uniqueTagLines(): string[] {
    return Array.from(new Set(this.presets.map((p) => p.tagLine))).sort();
  }
  favs = inject(FavoritesService);

  goFavorites() {
    this.router.navigate(['/favorites']);
  }

  openFavorite(f: FavoritePlayer) {
    this.router.navigate(['/summoner', f.region, f.gameName, f.tagLine]);
  }

  removeFavorite(f: FavoritePlayer) {
    this.favs.remove(f.region, f.gameName, f.tagLine);
  }

  clearFavorites() {
    this.favs.clear();
  }

  applyPlayerInput(value?: string) {
    const raw = (value ?? this.playerInput ?? '').trim();
    if (!raw) return;

    const preset = this.presets.find((p) => {
      const k1 = `${p.gameName}#${p.tagLine}`.toLowerCase();
      const k2 = (p.label || '').toLowerCase();
      const r = raw.toLowerCase();
      return r === k1 || r === k2;
    });

    if (preset) {
      this.region = preset.region;
      this.gameName = preset.gameName;
      this.tagLine = preset.tagLine;
      return;
    }

    if (raw.includes('#')) {
      const [g, t] = raw.split('#');
      const gg = (g ?? '').trim();
      const tt = (t ?? '').trim();
      if (gg) this.gameName = gg;
      if (tt) this.tagLine = tt;
    } else {
      this.gameName = raw;
    }
  }

  private normalizeInputs() {
    if ((!this.gameName || !this.tagLine) && (this.playerInput || '').includes('#')) {
      this.applyPlayerInput(this.playerInput);
    }
    if (this.gameName.includes('#') && !this.tagLine) {
      const [g, t] = this.gameName.split('#');
      this.gameName = (g ?? '').trim();
      this.tagLine = (t ?? '').trim();
    }
  }

  private summonerByPuuidWithFallback(region: RegionUI, puuid: string) {
    const first = REGION_TO_PLATFORM[region];
    const fallback = region === 'EUW' ? 'eun1' : region === 'EUNE' ? 'euw1' : null;

    return this.riot.summonerByPuuid(first, puuid).pipe(
      map((summoner) => ({ summoner, platformUsed: first })),
      catchError((err) => {
        if (err?.status === 404 && fallback) {
          return this.riot
            .summonerByPuuid(fallback, puuid)
            .pipe(map((summoner) => ({ summoner, platformUsed: fallback })));
        }
        return throwError(() => err);
      })
    );
  }

  openSummoner() {
    this.normalizeInputs();

    const g = this.gameName.trim();
    const t = this.tagLine.trim();
    if (!g || !t) return;

    this.router.navigate(['/summoner', this.region, g, t]);
  }

  search() {
    this.normalizeInputs();

    this.loading.set(true);
    this.error.set(null);
    this.data.set(null);

    const routing = REGION_TO_ROUTING[this.region];

    this.riot
      .accountByRiotId(routing, this.gameName.trim(), this.tagLine.trim())
      .pipe(
        switchMap((account) =>
          this.summonerByPuuidWithFallback(this.region, account.puuid).pipe(
            switchMap(({ summoner, platformUsed }) =>
              forkJoin({
                account: of(account),
                summoner: of(summoner),
                platformUsed: of(platformUsed),
                matchIds: this.riot.matchIdsByPuuid(routing, account.puuid, 0, 20),
              }).pipe(
                switchMap((base) => {
                  const first5 = (base.matchIds ?? []).slice(0, 5);
                  if (first5.length === 0) return of({ ...base, matches: [] });

                  return forkJoin(first5.map((id) => this.riot.matchById(routing, id))).pipe(
                    map((matches) => ({ ...base, matches }))
                  );
                })
              )
            )
          )
        )
      )
      .subscribe({
        next: (res) => {
          this.data.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          const body =
            typeof err?.error === 'string'
              ? err.error.slice(0, 160)
              : JSON.stringify(err?.error ?? {}).slice(0, 160);

          this.error.set(`HTTP ${err?.status ?? ''} | ${err?.message ?? ''} | ${body}`);
          this.loading.set(false);
        },
      });
  }
}
