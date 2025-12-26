import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

import { RiotApiService } from '../../core/riot-api';
import {
  ChampionService,
  ChampionData,
  SummonerSpellData,
  ItemData,
} from '../../core/services/champion.service';
import { QUEUE_NAMES } from '../../core/regions';

@Component({
  standalone: true,
  selector: 'app-match',
  imports: [CommonModule],
  template: `
    <div style="padding:16px">
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        <button (click)="back()">Înapoi</button>
        <button (click)="home()">Home</button>
      </div>

      <h2>Match Details</h2>

      <p *ngIf="loading()">Loading...</p>
      <p *ngIf="error()">{{ error() }}</p>

      <div *ngIf="data() as d">
        <p>
          <b>Queue:</b> {{ queueName(d.match?.info?.queueId) }}
          &nbsp;|&nbsp;
          <b>Duration:</b> {{ (d.match?.info?.gameDuration ?? 0) / 60 | number : '1.0-0' }} min
          &nbsp;|&nbsp; <b>DDragon:</b> {{ ddVersion() || '...' }}
        </p>

        <!-- Evidențiem jucătorul căutat -->
        <div
          *ngIf="player() as p"
          style="border:1px solid #ddd; padding:10px; border-radius:10px; margin:10px 0;"
        >
          <h3>Player (căutat)</h3>

          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
            <img
              *ngIf="champIconUrl(p.championId) as cicon"
              [src]="cicon"
              width="52"
              height="52"
              style="border-radius:12px; border:1px solid #ddd"
            />

            <div>
              <div style="font-weight:700">
                {{ champName(p.championId) || 'Champion #' + p.championId }}
                <span style="font-weight:400; opacity:.8"> — {{ p.win ? 'WIN' : 'LOSS' }}</span>
              </div>
              <div><b>KDA:</b> {{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</div>

              <div
                style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:6px;"
              >
                <img
                  *ngIf="spellIconUrl(p.summoner1Id) as s1"
                  [src]="s1"
                  width="26"
                  height="26"
                  style="border-radius:6px; border:1px solid #ddd"
                  [title]="spellTitle(p.summoner1Id) || 'Spell 1'"
                />

                <img
                  *ngIf="spellIconUrl(p.summoner2Id) as s2"
                  [src]="s2"
                  width="26"
                  height="26"
                  style="border-radius:6px; border:1px solid #ddd"
                  [title]="spellTitle(p.summoner2Id) || 'Spell 2'"
                />

                <ng-container *ngFor="let it of itemIds(p)">
                  <img
                    *ngIf="itemIconUrl(it) as iu"
                    [src]="iu"
                    width="26"
                    height="26"
                    style="border-radius:6px; border:1px solid #ddd"
                    [title]="itemTitle(it)"
                  />
                </ng-container>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabel simplu cu participanți -->
        <h3>Participants</h3>
        <div
          *ngFor="let p of d.match?.info?.participants"
          style="border:1px solid #eee; padding:8px; margin:6px 0; border-radius:10px;"
          [style.background]="p.puuid === puuid() ? '#f6f6f6' : 'transparent'"
        >
          <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; gap:10px; align-items:center;">
              <img
                *ngIf="champIconUrl(p.championId) as cicon"
                [src]="cicon"
                width="34"
                height="34"
                style="border-radius:10px; border:1px solid #ddd"
              />

              <div>
                <div style="font-weight:700">
                  {{ p.riotIdGameName || p.summonerName || 'Player' }}
                  <span style="font-weight:400; opacity:.8">
                    — {{ champName(p.championId) || '#' + p.championId }}</span
                  >
                </div>
                <div>
                  {{ p.win ? 'WIN' : 'LOSS' }} | KDA {{ p.kills }}/{{ p.deaths }}/{{ p.assists }}
                </div>
              </div>
            </div>

            <div style="opacity:.9">
              Gold: {{ p.goldEarned }} | Dmg: {{ p.totalDamageDealtToChampions }}
            </div>
          </div>
        </div>

        <details style="margin-top:12px">
          <summary>Debug JSON</summary>
          <pre>{{ d.match | json }}</pre>
        </details>
      </div>
    </div>
  `,
})
export class MatchComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  private riot = inject(RiotApiService);
  private champs = inject(ChampionService);

  loading = signal(false);
  error = signal<string | null>(null);

  data = signal<any>(null);
  player = signal<any>(null);

  routing = signal<string>('europe');
  matchId = signal<string>('');
  puuid = signal<string>('');

  ddVersion = signal<string>('');
  championsByKey = signal<Record<string, ChampionData>>({});
  spellsByKey = signal<Record<string, SummonerSpellData>>({});
  itemsById = signal<Record<string, ItemData>>({});

  ngOnInit() {
    // preload DataDragon
    this.champs.getVersion().subscribe({
      next: (v) => this.ddVersion.set(v),
      error: () => this.ddVersion.set(this.champs.getVersionSync()),
    });
    this.champs
      .getChampionsByKey()
      .subscribe({
        next: (m) => this.championsByKey.set(m),
        error: () => this.championsByKey.set({}),
      });
    this.champs
      .getSummonerSpellsByKey()
      .subscribe({ next: (m) => this.spellsByKey.set(m), error: () => this.spellsByKey.set({}) });
    this.champs
      .getItemsById()
      .subscribe({ next: (m) => this.itemsById.set(m), error: () => this.itemsById.set({}) });

    this.route.paramMap.subscribe((pm) => {
      this.routing.set(pm.get('routing') ?? 'europe');
      this.matchId.set(pm.get('matchId') ?? '');
      this.puuid.set(pm.get('puuid') ?? '');

      this.load();
    });
  }

  back() {
    this.location.back();
  }
  home() {
    this.router.navigate(['/']);
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
    const url = this.champs.championSquareUrlByNumericKeySync(
      championId ?? 0,
      this.championsByKey(),
      this.ddVer()
    );
    return url || null;
  }
  spellIconUrl(spellKey?: number) {
    const url = this.champs.spellIconUrlByNumericKeySync(
      spellKey ?? 0,
      this.spellsByKey(),
      this.ddVer()
    );
    return url || null;
  }
  spellTitle(spellKey?: number) {
    return this.champs.spellNameByNumericKeySync(spellKey ?? 0, this.spellsByKey());
  }
  itemIconUrl(itemId?: number) {
    const url = this.champs.getItemImageUrl(itemId ?? 0, this.ddVer());
    return url || null;
  }
  itemTitle(itemId?: number) {
    const id = String(itemId ?? 0);
    const name = this.itemsById()?.[id]?.name;
    return name ? `${name} (${id})` : `Item ${id}`;
  }
  itemIds(p: any): number[] {
    return [p?.item0, p?.item1, p?.item2, p?.item3, p?.item4, p?.item5, p?.item6]
      .map((x: any) => Number(x ?? 0))
      .filter((x) => !!x && x > 0);
  }

  private load() {
    const routing = this.routing();
    const matchId = this.matchId();
    const puuid = this.puuid();

    if (!routing || !matchId) return;

    this.loading.set(true);
    this.error.set(null);
    this.data.set(null);
    this.player.set(null);

    this.riot
      .matchById(routing, matchId)
      .pipe(map((match) => ({ match })))
      .subscribe({
        next: (res) => {
          this.data.set(res);
          const p = res.match?.info?.participants?.find((x: any) => x?.puuid === puuid) ?? null;
          this.player.set(p);
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
