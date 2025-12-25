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
  ItemData,
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

      @if (loading()) {
      <p>Loading...</p>
      } @if (error()) {
      <p>{{ error() }}</p>
      } @if (bundle(); as b) {
      <div>
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
        @if (b.rank?.length) {
        <div>
          <h3>Ranked</h3>
          @for (r of b.rank; track r) {
          <div style="border:1px solid #ddd; padding:8px; margin:6px 0">
            <b>{{ r.queueType }}</b> — {{ r.tier }} {{ r.rank }} ({{ r.leaguePoints }} LP)
            <div>W/L: {{ r.wins }}/{{ r.losses }}</div>
          </div>
          }
        </div>
        } @if (b.matchIds?.length === 0) {
        <div>Nu există meciuri pentru acest cont (sau e cont nou).</div>
        }

        <!-- Match history -->
        @if (b.matches?.length) {
        <div>
          <h3>Match history (primele {{ b.matches.length }})</h3>

          @for (m of b.matches; track m) {
          <div style="border:1px solid #ccc; padding:10px; margin:8px 0">
            <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap">
              <div>
                <b>{{ queueName(m.info?.queueId) }}</b>
              </div>
              <div>
                <b>Duration:</b> {{ (m.info?.gameDuration ?? 0) / 60 | number : '1.0-0' }} min
              </div>
            </div>

            <div><b>Match:</b> {{ m.metadata?.matchId }}</div>
            <button
              (click)="openMatch(m.metadata?.matchId, b.account.puuid)"
              style="margin-top:6px"
            >
              Detalii
            </button>

            <!-- Player summary -->
            @if (playerInMatch(m, b.account.puuid); as p) {
            <div style="margin-top:10px">
              <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
                <!-- Champion icon -->
                @if (champIconUrl(p.championId); as cicon) {
                <img
                  [src]="cicon"
                  width="52"
                  height="52"
                  style="border-radius:12px; border:1px solid #ddd"
                  [title]="champName(p.championId) || 'Champion #' + p.championId"
                />
                }

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
                    @if (spellIconUrl(p.summoner1Id); as s1) {
                    <img
                      [src]="s1"
                      width="26"
                      height="26"
                      style="border-radius:6px; border:1px solid #ddd"
                      [title]="spellTitle(p.summoner1Id) || 'Spell 1'"
                    />
                    } @if (spellIconUrl(p.summoner2Id); as s2) {
                    <img
                      [src]="s2"
                      width="26"
                      height="26"
                      style="border-radius:6px; border:1px solid #ddd"
                      [title]="spellTitle(p.summoner2Id) || 'Spell 2'"
                    />
                    }

                    <!-- Items -->
                    @for (it of itemIds(p); track it) { @if (itemIconUrl(it); as iu) {
                    <img
                      [src]="iu"
                      width="26"
                      height="26"
                      style="border-radius:6px; border:1px solid #ddd"
                      [title]="itemTitle(it)"
                    />
                    } }
                  </div>
                </div>
              </div>
            </div>
            } @if (!playerInMatch(m, b.account.puuid)) {
            <div style="margin-top:6px">
              <i>Nu am găsit participantul în acest match (debug).</i>
            </div>
            }
          </div>
          }
        </div>
        }

        <details style="margin-top:12px">
          <summary>Debug JSON</summary>
          <pre>{{ b | json }}</pre>
        </details>
      </div>
      }
    </div>
  `,
})
export class SummonerComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private riot = inject(RiotApiService);
  private location = inject(Location);

  // păstrez ce ai tu (chiar dacă e redundant)
  private champs = inject(ChampionService);
  private ddragon = inject(ChampionService);

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
  itemsById = signal<Record<string, ItemData>>({});

  ngOnInit() {
    // ✅ preload DataDragon (prin /champion-data proxy)
    this.ddragon.getVersion().subscribe({
      next: (v) => this.ddVersion.set(v),
      error: () => this.ddVersion.set(this.ddragon.getVersionSync()),
    });

    this.champs.getChampionsByKey().subscribe({
      next: (m) => this.championsByKey.set(m),
      error: () => this.championsByKey.set({}),
    });

    this.champs.getSummonerSpellsByKey().subscribe({
      next: (m) => this.spellsByKey.set(m),
      error: () => this.spellsByKey.set({}),
    });

    // ✅ LIPSEA: items map (pt title/nume)
    this.champs.getItemsById().subscribe({
      next: (m) => this.itemsById.set(m),
      error: () => this.itemsById.set({}),
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
  openMatch(matchId: string | undefined, puuid: string) {
    if (!matchId) return;

    this.router.navigate(['/match', this.region, matchId], {
      queryParams: { puuid }, // ca să știm pe cine evidențiem în MatchComponent
    });
  }

  queueName(queueId?: number) {
    if (!queueId) return 'Unknown queue';
    return QUEUE_NAMES[queueId] ?? `Queue ${queueId}`;
  }

  // ia participantul din match după puuid
  playerInMatch(match: any, puuid: string) {
    return match?.info?.participants?.find((p: any) => p?.puuid === puuid) ?? null;
  }

  // ✅ versiune sigură pt URL-uri (dacă ddVersion e încă gol)
  private ddVer(): string {
    return this.ddVersion() || this.ddragon.getVersionSync() || '14.1.1';
  }

  // ====== Champion / Spells / Items helpers (folosind ChampionService-ul tău) ======
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
