import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

import { RiotApiService } from '../../core/riot-api';
import {
  ChampionService,
  ChampionData,
  SummonerSpellData,
} from '../../core/services/champion.service';
import { QUEUE_NAMES, RegionUI } from '../../core/regions';

type TeamId = 100 | 200;

@Component({
  standalone: true,
  selector: 'app-live-game',
  imports: [CommonModule],
  template: `
    <div style="padding:16px">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        <button (click)="back()">Înapoi</button>
        <button (click)="home()">Home</button>
      </div>

      <h2>Live Game</h2>

      @if (loading()) {
      <p>Loading...</p>
      } @if (error()) {
      <p>{{ error() }}</p>
      } @if (!loading() && !error() && !game()) {
      <div style="border:1px solid #eee; padding:10px; border-radius:10px; opacity:.9;">
        <b>Nu este în joc</b> (sau s-a terminat între timp).
      </div>
      } @if (game(); as g) {
      <p>
        <b>Platform:</b> {{ platform() }}
        &nbsp;|&nbsp;
        <b>Queue:</b> {{ queueName(g.gameQueueConfigId) }}
        &nbsp;|&nbsp;
        <b>GameId:</b> {{ g.gameId }}
        &nbsp;|&nbsp;
        <b>Started:</b> {{ g.gameStartTime }}
        &nbsp;|&nbsp;
        <b>DDragon:</b> {{ ddVersion() || '...' }}
      </p>

      <!-- Bans (dacă există) -->
      @if (g.bannedChampions?.length) {
      <div style="border:1px solid #eee; padding:10px; border-radius:10px; margin:10px 0;">
        <b>Bans:</b>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
          @for (bc of g.bannedChampions; track bc) { @if (champIconUrl(bc.championId); as ic) {
          <img
            [src]="ic"
            width="26"
            height="26"
            style="border-radius:6px; border:1px solid #ddd"
            [title]="champName(bc.championId) || '#' + bc.championId"
          />
          } }
        </div>
      </div>
      }

      <!-- Teams -->
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px;">
        <!-- BLUE -->
        <div
          style="flex:1; min-width:360px; border:1px solid #ddd; border-radius:12px; padding:10px;"
        >
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b>Blue (100)</b>
            <span style="opacity:.8">{{ team(100)?.length ?? 0 }} players</span>
          </div>

          @for (p of team(100); track p) {
          <div style="border-top:1px solid #eee; padding-top:10px; margin-top:10px;">
            <div style="display:flex; gap:10px; align-items:flex-start;">
              @if (champIconUrl(p.championId); as cicon) {
              <img
                [src]="cicon"
                width="34"
                height="34"
                style="border-radius:10px; border:1px solid #ddd"
                [title]="champName(p.championId) || '#' + p.championId"
              />
              }

              <div style="flex:1;">
                <div style="font-weight:700">
                  {{ p.riotId || p.summonerName || 'Player' }}
                  <span style="font-weight:400; opacity:.8"
                    >— {{ champName(p.championId) || '#' + p.championId }}</span
                  >
                </div>

                <div
                  style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:6px;"
                >
                  @if (spellIconUrl(p.spell1Id); as s1) {
                  <img
                    [src]="s1"
                    width="22"
                    height="22"
                    style="border-radius:6px; border:1px solid #ddd"
                    [title]="spellTitle(p.spell1Id) || 'Spell 1'"
                  />
                  } @if (spellIconUrl(p.spell2Id); as s2) {
                  <img
                    [src]="s2"
                    width="22"
                    height="22"
                    style="border-radius:6px; border:1px solid #ddd"
                    [title]="spellTitle(p.spell2Id) || 'Spell 2'"
                  />
                  }
                </div>
                <button (click)="openByPuuid(p.puuid)" style="margin-top:6px">
                  Deschide profil
                </button>
              </div>
            </div>
          </div>
          }
        </div>

        <!-- RED -->
        <div
          style="flex:1; min-width:360px; border:1px solid #ddd; border-radius:12px; padding:10px;"
        >
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <b>Red (200)</b>
            <span style="opacity:.8">{{ team(200)?.length ?? 0 }} players</span>
          </div>

          @for (p of team(200); track p) {
          <div style="border-top:1px solid #eee; padding-top:10px; margin-top:10px;">
            <div style="display:flex; gap:10px; align-items:flex-start;">
              @if (champIconUrl(p.championId); as cicon) {
              <img
                [src]="cicon"
                width="34"
                height="34"
                style="border-radius:10px; border:1px solid #ddd"
                [title]="champName(p.championId) || '#' + p.championId"
              />
              }

              <div style="flex:1;">
                <div style="font-weight:700">
                  {{ p.riotId || p.summonerName || 'Player' }}
                  <span style="font-weight:400; opacity:.8"
                    >— {{ champName(p.championId) || '#' + p.championId }}</span
                  >
                </div>

                <div
                  style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:6px;"
                >
                  @if (spellIconUrl(p.spell1Id); as s1) {
                  <img
                    [src]="s1"
                    width="22"
                    height="22"
                    style="border-radius:6px; border:1px solid #ddd"
                    [title]="spellTitle(p.spell1Id) || 'Spell 1'"
                  />
                  } @if (spellIconUrl(p.spell2Id); as s2) {
                  <img
                    [src]="s2"
                    width="22"
                    height="22"
                    style="border-radius:6px; border:1px solid #ddd"
                    [title]="spellTitle(p.spell2Id) || 'Spell 2'"
                  />
                  }
                </div>
                <button (click)="openByPuuid(p.puuid)" style="margin-top:6px">
                  Deschide profil
                </button>
              </div>
            </div>
          </div>
          }
        </div>
      </div>

      <details style="margin-top:12px">
        <summary>Debug JSON</summary>
        <pre>{{ g | json }}</pre>
      </details>
      }
    </div>
  `,
})
export class LiveGameComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  private riot = inject(RiotApiService);
  private champs = inject(ChampionService);

  loading = signal(false);
  error = signal<string | null>(null);

  platform = signal<string>('euw1');
  summonerId = signal<string>('');

  game = signal<any>(null);

  ddVersion = signal<string>('');
  championsByKey = signal<Record<string, ChampionData>>({});
  spellsByKey = signal<Record<string, SummonerSpellData>>({});

  ngOnInit() {
    // DataDragon preload
    this.champs.getVersion().subscribe({
      next: (v) => this.ddVersion.set(v),
      error: () => this.ddVersion.set(this.champs.getVersionSync()),
    });

    this.champs.getChampionsByKey().subscribe({
      next: (m) => this.championsByKey.set(m),
      error: () => this.championsByKey.set({}),
    });

    this.champs.getSummonerSpellsByKey().subscribe({
      next: (m) => this.spellsByKey.set(m),
      error: () => this.spellsByKey.set({}),
    });

    // params
    this.route.paramMap.subscribe((pm) => {
      this.platform.set(pm.get('platform') ?? 'euw1');
      this.summonerId.set(pm.get('summonerId') ?? '');
      this.load();
    });
  }

  back() {
    this.location.back();
  }
  home() {
    this.router.navigate(['/']);
  }

  private regionFromPlatform(platform: string): RegionUI {
    const p = (platform || '').toLowerCase();
    if (p.startsWith('euw')) return 'EUW';
    if (p.startsWith('eun')) return 'EUNE';
    if (p.startsWith('na')) return 'NA';
    return 'EUW';
  }

  openByPuuid(puuid: string) {
    if (!puuid) return;
    const region = this.regionFromPlatform(this.platform());
    this.router.navigate(['/summoner-puuid', region, puuid]);
  }

  private ddVer(): string {
    return this.ddVersion() || this.champs.getVersionSync() || '14.1.1';
  }

  queueName(queueId?: number) {
    if (!queueId) return 'Unknown queue';
    return QUEUE_NAMES[queueId] ?? `Queue ${queueId}`;
  }

  champName(championId?: number) {
    return this.champs.championNameByNumericKeySync(championId ?? 0, this.championsByKey());
  }
  champIconUrl(championId?: number) {
    return (
      this.champs.championSquareUrlByNumericKeySync(
        championId ?? 0,
        this.championsByKey(),
        this.ddVer()
      ) || null
    );
  }

  spellIconUrl(spellKey?: number) {
    return (
      this.champs.spellIconUrlByNumericKeySync(spellKey ?? 0, this.spellsByKey(), this.ddVer()) ||
      null
    );
  }

  spellTitle(spellKey?: number) {
    return this.champs.spellNameByNumericKeySync(spellKey ?? 0, this.spellsByKey());
  }

  team(teamId: TeamId) {
    return (this.game()?.participants ?? []).filter((p: any) => p?.teamId === teamId);
  }

  private load() {
    const platform = this.platform();
    const summonerId = this.summonerId();
    if (!platform || !summonerId) return;

    this.loading.set(true);
    this.error.set(null);
    this.game.set(null);

    this.riot
      .getCurrentGame(platform, summonerId)
      .pipe(
        catchError((err) => {
          // 404 = not in game (normal)
          if (err?.status === 404) return of(null);
          return throwError(() => err);
        })
      )
      .subscribe({
        next: (g) => {
          this.game.set(g);
          this.loading.set(false);
        },
        error: (err) => {
          const body =
            typeof err?.error === 'string'
              ? err.error.slice(0, 160)
              : JSON.stringify(err?.error ?? {}).slice(0, 160);

          this.error.set(
            `HTTP ${err?.status ?? ''} ${err?.statusText ?? ''} | ${err?.message ?? ''} | ${body}`
          );
          this.loading.set(false);
        },
      });
  }
}
