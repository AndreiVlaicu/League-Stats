import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';

import { RiotApiService } from '../../core/riot-api';
import {
  ChampionService,
  ChampionData,
  SummonerSpellData,
} from '../../core/services/champion.service'; // <- ajustează path dacă e diferit
import { RegionUI, REGION_TO_PLATFORM, REGION_TO_ROUTING, QUEUE_NAMES } from '../../core/regions';

@Component({
  standalone: true,
  selector: 'app-summoner',
  imports: [CommonModule, FormsModule],
  template: `
    <div style="padding:16px">
      <!-- Search bar + nav -->
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
        <select [(ngModel)]="region">
          <option>EUW</option>
          <option>EUNE</option>
          <option>NA</option>
        </select>

        <input [(ngModel)]="gameName" placeholder="gameName" />
        <input [(ngModel)]="tagLine" placeholder="tagLine" />

        <button (click)="go()">Caută</button>
        <button (click)="back()">Înapoi</button>
        <button (click)="home()">Home</button>
      </div>

      <h2>Summoner</h2>

      <p *ngIf="loading()">Loading...</p>
      <p *ngIf="error()">{{ error() }}</p>

      <div *ngIf="bundle() as b">
        <h3>{{ b.account.gameName }}#{{ b.account.tagLine }}</h3>

        <p>
          <b>Platform:</b> {{ b.platform }}
          &nbsp;|&nbsp;
          <b>Level:</b> {{ b.summoner.summonerLevel }}
          &nbsp;|&nbsp;
          <b>IconId:</b> {{ b.summoner.profileIconId }}
          &nbsp;|&nbsp;
          <b>DDragon:</b> {{ ddVersion() || '...' }}
        </p>

        <!-- Rank -->
        <div *ngIf="b.rank?.length">
          <h3>Ranked</h3>
          <div *ngFor="let r of b.rank" style="border:1px solid #ddd; padding:8px; margin:6px 0">
            <b>{{ r.queueType }}</b> — {{ r.tier }} {{ r.rank }} ({{ r.leaguePoints }} LP)
            <div>W/L: {{ r.wins }}/{{ r.losses }}</div>
          </div>
        </div>

        <div *ngIf="b.matchIds?.length === 0">
          Nu există meciuri pentru acest cont (sau e cont nou).
        </div>

        <!-- Match history -->
        <div *ngIf="b.matches?.length">
          <h3>Match history (primele {{ b.matches.length }})</h3>

          <div
            *ngFor="let m of b.matches"
            style="border:1px solid #ccc; padding:10px; margin:8px 0"
          >
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap">
              <div>
                <b>{{ queueName(m.info?.queueId) }}</b>
              </div>
              <div>
                <b>Duration:</b> {{ (m.info?.gameDuration ?? 0) / 60 | number : '1.0-0' }} min
              </div>
            </div>

            <div><b>Match:</b> {{ m.metadata?.matchId }}</div>

            <!-- Player summary -->
            <div *ngIf="playerInMatch(m, b.account.puuid) as p" style="margin-top:10px">
              <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
                <!-- Champion icon -->
                <img
                  *ngIf="champIconUrl(p.championId) as cicon"
                  [src]="cicon"
                  width="52"
                  height="52"
                  style="border-radius:12px; border:1px solid #ddd"
                />

                <div style="flex:1; min-width:240px">
                  <div style="font-weight:700">
                    {{ champName(p.championId) || 'Champion #' + p.championId }}
                    <span style="font-weight:400; opacity:.8"> — {{ p.win ? 'WIN' : 'LOSS' }}</span>
                  </div>

                  <div><b>KDA:</b> {{ p.kills }}/{{ p.deaths }}/{{ p.assists }}</div>

                  <!-- Spells + Items row -->
                  <div
                    style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:6px;"
                  >
                    <!-- Spells -->
                    <img
                      *ngIf="spellIconUrl(p.summoner1Id) as s1"
                      [src]="s1"
                      width="26"
                      height="26"
                      style="border-radius:6px; border:1px solid #ddd"
                      title="Spell 1"
                    />
                    <img
                      *ngIf="spellIconUrl(p.summoner2Id) as s2"
                      [src]="s2"
                      width="26"
                      height="26"
                      style="border-radius:6px; border:1px solid #ddd"
                      title="Spell 2"
                    />

                    <!-- Items -->
                    <ng-container *ngFor="let it of itemIds(p)">
                      <img
                        *ngIf="itemIconUrl(it) as iu"
                        [src]="iu"
                        width="26"
                        height="26"
                        style="border-radius:6px; border:1px solid #ddd"
                        [title]="'Item ' + it"
                      />
                    </ng-container>
                  </div>
                </div>
              </div>
            </div>

            <div *ngIf="!playerInMatch(m, b.account.puuid)" style="margin-top:6px">
              <i>Nu am găsit participantul în acest match (debug).</i>
            </div>
          </div>
        </div>

        <details style="margin-top:12px">
          <summary>Debug JSON</summary>
          <pre>{{ b | json }}</pre>
        </details>
      </div>
    </div>
  `,
})
export class SummonerComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private riot = inject(RiotApiService);
  private location = inject(Location);
  private champs = inject(ChampionService);

  // inputs
  region: RegionUI = 'EUW';
  gameName = '';
  tagLine = '';

  loading = signal(false);
  error = signal<string | null>(null);
  bundle = signal<any>(null);

  // DataDragon caches (maps)
  ddVersion = signal<string>('');
  championsByKey = signal<Record<string, ChampionData>>({});
  spellsByKey = signal<Record<string, SummonerSpellData>>({});

  ngOnInit() {
    // preload DataDragon (prin /champion-data proxy)
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

    this.route.paramMap.subscribe((pm) => {
      const region = (pm.get('region') as RegionUI) ?? 'EUW';
      const gameName = pm.get('gameName') ?? '';
      const tagLine = pm.get('tagLine') ?? '';

      this.region = region;
      this.gameName = gameName;
      this.tagLine = tagLine;

      this.load(region, gameName, tagLine);
    });
  }

  go() {
    const g = this.gameName.trim();
    const t = this.tagLine.trim();
    if (!g || !t) return;

    this.router.navigate(['/summoner', this.region, g, t]);
  }

  back() {
    this.location.back();
  }

  home() {
    this.router.navigate(['/']);
  }

  queueName(queueId?: number) {
    if (!queueId) return 'Unknown queue';
    return QUEUE_NAMES[queueId] ?? `Queue ${queueId}`;
  }

  // ia participantul din match după puuid
  playerInMatch(match: any, puuid: string) {
    return match?.info?.participants?.find((p: any) => p?.puuid === puuid) ?? null;
  }

  // ====== Champion / Spells / Items helpers (folosind ChampionService-ul tău) ======
  champName(championId?: number) {
    return this.champs.championNameByNumericKeySync(championId ?? 0, this.championsByKey());
  }

  champIconUrl(championId?: number) {
    const url = this.champs.championSquareUrlByNumericKeySync(
      championId ?? 0,
      this.championsByKey(),
      this.ddVersion()
    );
    return url || null;
  }

  spellIconUrl(spellKey?: number) {
    const url = this.champs.spellIconUrlByNumericKeySync(
      spellKey ?? 0,
      this.spellsByKey(),
      this.ddVersion()
    );
    return url || null;
  }

  itemIconUrl(itemId?: number) {
    const url = this.champs.getItemImageUrl(itemId ?? 0, this.ddVersion());
    return url || null;
  }

  itemIds(p: any): number[] {
    // item0..item6 există în match-v5 participant
    return [p?.item0, p?.item1, p?.item2, p?.item3, p?.item4, p?.item5, p?.item6]
      .map((x: any) => Number(x ?? 0))
      .filter((x) => !!x && x > 0);
  }

  // ====== fallback EUW <-> EUNE pentru summoner lookup ======
  private summonerByPuuidWithFallback(region: RegionUI, puuid: string) {
    const first = REGION_TO_PLATFORM[region];
    const fallback = region === 'EUW' ? 'eun1' : region === 'EUNE' ? 'euw1' : null;

    return this.riot.summonerByPuuid(first, puuid).pipe(
      map((summoner) => ({ summoner, platform: first })),
      catchError((err) => {
        const status = err?.status ?? err?.error?.status?.status_code ?? err?.error?.status_code;

        if (status === 404 && fallback) {
          return this.riot
            .summonerByPuuid(fallback, puuid)
            .pipe(map((summoner) => ({ summoner, platform: fallback })));
        }
        return throwError(() => err);
      })
    );
  }

  private load(region: RegionUI, gameName: string, tagLine: string) {
    this.loading.set(true);
    this.error.set(null);
    this.bundle.set(null);

    const routing = REGION_TO_ROUTING[region];

    this.riot
      .accountByRiotId(routing, gameName, tagLine)
      .pipe(
        // 1) account + summoner (+ platform real)
        switchMap((account) =>
          this.summonerByPuuidWithFallback(region, account.puuid).pipe(
            map(({ summoner, platform }) => ({ account, summoner, platform }))
          )
        ),

        // 2) rank + matchIds
        switchMap(({ account, summoner, platform }) =>
          forkJoin({
            rank: summoner?.id ? this.riot.getRankBySummonerId(platform, summoner.id) : of([]),
            matchIds: this.riot.matchIdsByPuuid(routing, account.puuid, 0, 20),
          }).pipe(map((extra) => ({ account, summoner, platform, ...extra })))
        ),

        // 3) match details primele 5
        switchMap((base2) => {
          const ids = (base2.matchIds ?? []).slice(0, 5);
          if (ids.length === 0) return of({ ...base2, matches: [] });

          return forkJoin(ids.map((id: string) => this.riot.matchById(routing, id))).pipe(
            map((matches) => ({ ...base2, matches }))
          );
        })
      )
      .subscribe({
        next: (res) => {
          this.bundle.set(res);
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
